import { NextRequest } from "next/server"
import OpenAI from "openai"
import prisma from "@/lib/prisma"
import { createJobWithSteps } from "@/server/orchestrator"
import type { Prisma } from "@prisma/client"

// Streaming rewrite endpoint using Server-Sent Events
export async function POST(request: NextRequest) {
    const body = await request.json()
    const { originalText, params, workspaceId, contentItemId } = body

    if (!originalText) {
        return new Response(JSON.stringify({ error: "originalText is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        })
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim()

    const orchestration = workspaceId
        ? await prisma.$transaction(async (tx) => {
            const { job, steps } = await createJobWithSteps(
                {
                    type: "REWRITE",
                    workspaceId,
                    config: {
                        mode: "stream",
                        contentItemId: contentItemId ?? null,
                        params: params ?? {},
                    },
                    steps: [
                        {
                            type: "REWRITE",
                            status: "RUNNING",
                            maxAttempts: 1,
                            inputRef: { contentItemId: contentItemId ?? null },
                            availableAt: new Date(),
                        },
                    ],
                },
                tx
            )

            const stepId = steps[0]?.id
            await tx.job.update({ where: { id: job.id }, data: { status: "RUNNING" } })
            if (stepId) {
                await tx.step.update({ where: { id: stepId }, data: { startedAt: new Date() } })
            }
            return stepId ? { jobId: job.id, stepId } : null
        })
        : null

    const encoder = new TextEncoder()

    // If no API key, return mock stream
    if (!apiKey) {
        return createMockStream(originalText, params, orchestration)
    }

    try {
        const openai = new OpenAI({ apiKey })

        const systemPrompt = buildSystemPrompt(params)
        const userPrompt = buildUserPrompt(originalText, params)

        const stream = await openai.chat.completions.create({
            model: process.env.OPENAI_MODEL || "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt },
            ],
            stream: true,
            temperature: 0.7,
            max_tokens: 1000,
        })

        const readable = new ReadableStream({
            async start(controller) {
                try {
                    if (orchestration) {
                        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jobId: orchestration.jobId, stepId: orchestration.stepId })}\n\n`))
                    }

                    let charCount = 0
                    for await (const chunk of stream) {
                        const content = chunk.choices[0]?.delta?.content || ""
                        if (content) {
                            charCount += content.length
                            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content })}\n\n`))
                        }
                    }
                    if (orchestration) {
                        await prisma.step.update({
                            where: { id: orchestration.stepId },
                            data: {
                                status: "SUCCEEDED",
                                completedAt: new Date(),
                                outputRef: { charCount } as Prisma.InputJsonValue,
                                error: {},
                            },
                        })
                        await prisma.job.update({ where: { id: orchestration.jobId }, data: { status: "DONE" } })
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
                    controller.close()
                } catch (error) {
                    if (orchestration) {
                        await prisma.step.update({
                            where: { id: orchestration.stepId },
                            data: {
                                status: "FAILED",
                                completedAt: new Date(),
                                error: {
                                    code: "REWRITE_STREAM_FAILED",
                                    message: String(error),
                                    at: new Date().toISOString(),
                                } as Prisma.InputJsonValue,
                            },
                        })
                        await prisma.job.update({ where: { id: orchestration.jobId }, data: { status: "FAILED" } })
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: String(error) })}\n\n`))
                    controller.close()
                }
            },
        })

        return new Response(readable, {
            headers: {
                "Content-Type": "text/event-stream",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
            },
        })
    } catch (error) {
        if (orchestration) {
            await prisma.step.update({
                where: { id: orchestration.stepId },
                data: {
                    status: "FAILED",
                    completedAt: new Date(),
                    error: {
                        code: "REWRITE_STREAM_FAILED",
                        message: String(error),
                        at: new Date().toISOString(),
                    } as Prisma.InputJsonValue,
                },
            }).catch(() => null)
            await prisma.job.update({ where: { id: orchestration.jobId }, data: { status: "FAILED" } }).catch(() => null)
        }
        console.error("Streaming rewrite error:", error)
        return new Response(JSON.stringify({ error: "Failed to generate rewrite" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        })
    }
}

function createMockStream(
    originalText: string,
    params: Record<string, unknown>,
    orchestration: { jobId: string; stepId: string } | null
) {
    const language = params?.language === "en" ? "en" : "zh"
    const mockText = language === "zh"
        ? `这是对原文的改写版本。原文核心观点是：${originalText.slice(0, 50)}...\n\n我的理解：这段内容的关键在于抓住变量、理解本质、找到可执行的切入点。不是简单复述，而是提炼出可迁移的认知框架。\n\n行动建议：1) 先理解原作者的核心主张；2) 找到与自己场景的连接点；3) 给出一个具体的下一步行动。`
        : `Here is a rewritten version of the original content: "${originalText.slice(0, 50)}..."\n\nMy take: The key insight here is about identifying the core variables, understanding the underlying principles, and finding actionable entry points.\n\nAction item: Start by identifying the one thing that would make the biggest difference in your context.`

    const encoder = new TextEncoder()
    const words = mockText.split("")
    let index = 0

    const readable = new ReadableStream({
        async start(controller) {
            if (orchestration) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jobId: orchestration.jobId, stepId: orchestration.stepId })}\n\n`))
            }

            const interval = setInterval(() => {
                if (index < words.length) {
                    const char = words[index]
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: char })}\n\n`))
                    index++
                } else {
                    clearInterval(interval)
                    if (orchestration) {
                        prisma.step.update({
                            where: { id: orchestration.stepId },
                            data: {
                                status: "SUCCEEDED",
                                completedAt: new Date(),
                                outputRef: { charCount: words.length } as Prisma.InputJsonValue,
                                error: {},
                            },
                        }).catch(() => null)
                        prisma.job.update({ where: { id: orchestration.jobId }, data: { status: "DONE" } }).catch(() => null)
                    }
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
                    controller.close()
                }
            }, 20) // Simulate typing speed
        },
    })

    return new Response(readable, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
        },
    })
}

function buildSystemPrompt(params: Record<string, unknown>) {
    const persona = params?.targetPersona || "独立思考者"
    const tone = params?.audienceTone || "专业但易懂"
    const language = params?.language === "en" ? "English" : "中文"

    return `你是一位资深内容创作者，风格定位是「${persona}」，语气「${tone}」。
你的任务是对输入内容进行"强改写"——不是逐句翻译或复述，而是：
1. 提炼核心观点
2. 用你自己的表达方式重新阐述
3. 加入你的见解或补充
4. 给出可执行的建议

输出语言：${language}
输出要求：直接输出改写后的内容，不要加任何前缀说明。`
}

function buildUserPrompt(originalText: string, params: Record<string, unknown>) {
    const stance = params?.stance || "neutral"
    let stancePrompt = ""
    switch (stance) {
        case "agree": stancePrompt = "请从支持该观点的角度改写。"; break
        case "disagree": stancePrompt = "请从质疑或反驳该观点的角度改写。"; break
        case "compare": stancePrompt = "请从多角度对比分析的角度改写。"; break
        case "supplement": stancePrompt = "请补充原文未提及的重要视角。"; break
        default: stancePrompt = "请保持中立客观的角度改写。"
    }

    return `原文内容：
---
${originalText}
---

${stancePrompt}

请开始改写：`
}
