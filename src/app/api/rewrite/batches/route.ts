import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import OpenAI from "openai"
import { createJobWithSteps } from "@/server/orchestrator"
import type { Prisma } from "@prisma/client"

let openaiClient: OpenAI | null = null
function getOpenAIClient(): OpenAI | null {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) return null
    if (!openaiClient) openaiClient = new OpenAI({ apiKey })
    return openaiClient
}

// GET /api/rewrite/batches - 获取改写批次列表
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")
        const status = searchParams.get("status")
        const limit = parseInt(searchParams.get("limit") || "20")

        const batches = await prisma.rewriteBatch.findMany({
            where: {
                ...(workspaceId && { workspaceId }),
                ...(status && { status: status as "QUEUED" | "RUNNING" | "DONE" | "PARTIAL_FAILED" }),
            },
            include: {
                preset: { select: { id: true, name: true } },
                workspace: { select: { id: true, name: true } },
                _count: { select: { versions: true } }
            },
            take: limit,
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ batches })
    } catch (error) {
        console.error("Failed to fetch rewrite batches:", error)
        return NextResponse.json(
            { error: "Failed to fetch rewrite batches" },
            { status: 500 }
        )
    }
}

// POST /api/rewrite/batches - 创建改写批次
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, itemIds, presetId, name, params } = body

        if (!workspaceId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
            return NextResponse.json(
                { error: "workspaceId and itemIds are required" },
                { status: 400 }
            )
        }

        // 获取内容项
        const items = await prisma.contentItem.findMany({
            where: {
                id: { in: itemIds },
                workspaceId,
            }
        })

        if (items.length === 0) {
            return NextResponse.json(
                { error: "No valid items found" },
                { status: 400 }
            )
        }

        // 获取预设配置（如果有）
        let presetConfig = null
        if (presetId) {
            presetConfig = await prisma.rewritePreset.findUnique({
                where: { id: presetId }
            })
        }

        const resolvedParams = params || presetConfig || {}

        const { batch, orchestrationJobId, orchestrationStepId } = await prisma.$transaction(async (tx) => {
            const batch = await tx.rewriteBatch.create({
                data: {
                    workspaceId,
                    presetId,
                    name: name || `改写批次 ${new Date().toLocaleDateString("zh-CN")}`,
                    params: resolvedParams,
                    status: "RUNNING",
                    total: items.length,
                    startedAt: new Date(),
                }
            })

            const { job: orchestrationJob, steps } = await createJobWithSteps(
                {
                    type: "REWRITE",
                    workspaceId,
                    config: {
                        rewriteBatchId: batch.id,
                        presetId: presetId ?? null,
                        params: resolvedParams,
                        itemCount: items.length,
                    },
                    steps: [
                        {
                            type: "REWRITE",
                            status: "RUNNING",
                            maxAttempts: 1,
                            inputRef: { rewriteBatchId: batch.id },
                            availableAt: new Date(),
                        },
                    ],
                },
                tx
            )

            const stepId = steps[0]?.id
            await tx.rewriteBatch.update({
                where: { id: batch.id },
                data: { jobId: orchestrationJob.id },
            })
            await tx.job.update({ where: { id: orchestrationJob.id }, data: { status: "RUNNING" } })
            if (stepId) {
                await tx.step.update({ where: { id: stepId }, data: { startedAt: new Date() } })
            }

            return { batch, orchestrationJobId: orchestrationJob.id, orchestrationStepId: stepId ?? null }
        })

        // 更新内容项状态
        await prisma.contentItem.updateMany({
            where: { id: { in: itemIds } },
            data: { rewriteStatus: "DRAFTING" }
        })

        // 为每个内容项生成改写版本
        const rewriteResults = await Promise.allSettled(
            items.map(async (item) => {
                const rewriteParams = resolvedParams || {
                    targetPersona: "专业内容创作者",
                    audienceTone: "专业但易懂",
                    stance: "neutral",
                    outputFormat: "single",
                    language: "zh",
                }

                // 调用 OpenAI 进行改写
                const rewrittenText = await generateRewrite(item.textOriginal, rewriteParams)

                // 计算相似度（简化版本）
                const similarityScore = calculateSimilarity(item.textOriginal, rewrittenText)

                // 创建改写版本
                const version = await prisma.rewriteVersion.create({
                    data: {
                        contentItemId: item.id,
                        batchId: batch.id,
                        jobId: orchestrationJobId,
                        stepId: orchestrationStepId,
                        version: 1,
                        output: { text: rewrittenText },
                        outputFormat: rewriteParams.outputFormat || "single",
                        paramsSnapshot: rewriteParams,
                        status: "GENERATED",
                        charCount: rewrittenText.length,
                        similarityScore,
                        warnings: similarityScore > 0.5 ? ["与原文相似度较高，建议进一步改写"] : [],
                    }
                })

                // 更新内容项状态
                await prisma.contentItem.update({
                    where: { id: item.id },
                    data: { rewriteStatus: "GENERATED" }
                })

                return version
            })
        )

        // 统计结果
        const succeeded = rewriteResults.filter(r => r.status === "fulfilled").length
        const failed = rewriteResults.filter(r => r.status === "rejected").length

        // 更新批次状态
        await prisma.rewriteBatch.update({
            where: { id: batch.id },
            data: {
                status: failed === 0 ? "DONE" : "PARTIAL_FAILED",
                succeeded,
                failed,
                completedAt: new Date(),
            }
        })

        // 写入 v2 Job/Step 状态
        if (orchestrationJobId) {
            await prisma.job.update({
                where: { id: orchestrationJobId },
                data: { status: failed === 0 ? "DONE" : "FAILED" },
            })
        }
        if (orchestrationStepId) {
            await prisma.step.update({
                where: { id: orchestrationStepId },
                data: {
                    status: failed === 0 ? "SUCCEEDED" : "FAILED",
                    completedAt: new Date(),
                    outputRef: { total: items.length, succeeded, failed } as Prisma.InputJsonValue,
                    ...(failed === 0
                        ? { error: {} }
                        : {
                            error: {
                                code: "REWRITE_PARTIAL_FAILED",
                                message: `Rewrite batch partially failed (${failed}/${items.length})`,
                                at: new Date().toISOString(),
                            } as Prisma.InputJsonValue,
                        }),
                },
            })
        }

        // 记录审计日志
        await prisma.auditLog.create({
            data: {
                workspaceId,
                action: "REWRITE_CREATED",
                details: {
                    batchId: batch.id,
                    orchestrationJobId,
                    total: items.length,
                    succeeded,
                    failed,
                },
                actor: "system",
            }
        })

        return NextResponse.json({
            batch: {
                id: batch.id,
                status: failed === 0 ? "DONE" : "PARTIAL_FAILED",
                total: items.length,
                succeeded,
                failed,
            }
        }, { status: 201 })

    } catch (error) {
        console.error("Failed to create rewrite batch:", error)
        return NextResponse.json(
            { error: "Failed to create rewrite batch" },
            { status: 500 }
        )
    }
}

// AI 改写函数
async function generateRewrite(
    originalText: string,
    params: {
        targetPersona?: string
        audienceTone?: string
        stance?: string
        outputFormat?: string
        language?: string
        includeHook?: boolean
        includeConclusion?: boolean
        includeCTA?: boolean
    }
): Promise<string> {
    const openai = getOpenAIClient()
    if (!openai) {
        return generateMockRewrite(originalText, params)
    }

    try {
        const systemPrompt = buildSystemPrompt(params)
        const userPrompt = buildUserPrompt(originalText, params)

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: userPrompt }
            ],
            temperature: 0.7,
            max_tokens: 1000,
        })

        return response.choices[0]?.message?.content || generateMockRewrite(originalText, params)
    } catch (error) {
        console.error("OpenAI API error:", error)
        return generateMockRewrite(originalText, params)
    }
}

// 构建系统提示词
function buildSystemPrompt(params: { targetPersona?: string; audienceTone?: string; language?: string }): string {
    const persona = params.targetPersona || "专业内容创作者"
    const tone = params.audienceTone || "专业但易懂"
    const language = params.language === "zh" ? "中文" : "英文"

    return `你是一个${persona}，擅长将他人的观点和内容重新组织和表达，形成独特的视角和见解。

你的任务是：
1. 深入理解原文的核心观点
2. 用全新的角度和表达方式重新阐述
3. 确保内容原创性高，避免简单的同义词替换
4. 保持${tone}的语气风格
5. 使用${language}输出

注意：
- 不是翻译，是重新创作
- 可以补充自己的见解和案例
- 可以调整观点的结构和顺序
- 输出必须是适合社交媒体发布的格式`
}

// 构建用户提示词
function buildUserPrompt(
    originalText: string,
    params: { stance?: string; includeHook?: boolean; includeConclusion?: boolean; includeCTA?: boolean }
): string {
    let prompt = `请对以下内容进行强改写：

原文：
"""
${originalText}
"""

改写要求：`

    if (params.stance) {
        const stanceMap: Record<string, string> = {
            agree: "表达支持和认同的立场",
            disagree: "表达不同意见或反驳的立场",
            neutral: "保持客观中立的分析立场",
            compare: "对比分析不同观点",
            supplement: "在原观点基础上补充新的视角",
        }
        prompt += `\n- ${stanceMap[params.stance] || stanceMap.neutral}`
    }

    if (params.includeHook !== false) {
        prompt += "\n- 开头要有吸引眼球的钩子"
    }

    if (params.includeConclusion !== false) {
        prompt += "\n- 结尾要有清晰的总结或观点"
    }

    if (params.includeCTA) {
        prompt += "\n- 添加行动号召或互动引导"
    }

    prompt += "\n\n请直接输出改写后的内容，不要添加任何解释或前缀："

    return prompt
}

// 模拟改写（当 OpenAI API 不可用时）
function generateMockRewrite(originalText: string, params: { language?: string }): string {
    const isZh = params.language !== "en"

    if (isZh) {
        // 生成中文改写
        const hooks = [
            "💡 一个有趣的观察：",
            "🔥 值得深思的话题：",
            "📌 最近在思考一个问题：",
            "🎯 分享一个重要的洞察：",
        ]

        const conclusions = [
            "\n\n你怎么看这个观点？欢迎讨论 👇",
            "\n\n这是我的理解，期待不同声音 💬",
            "\n\n思考比答案更重要 🤔",
        ]

        const hook = hooks[Math.floor(Math.random() * hooks.length)]
        const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)]

        // 简单的内容转换（实际应该是 AI 生成）
        const rewrittenBody = `在当今快速变化的环境中，这个话题变得越来越重要。

原观点提到的核心问题确实值得我们关注。但我想从另一个角度来分析：

1. 首先，我们需要理解背后的深层逻辑
2. 其次，考虑实际应用中的挑战
3. 最后，思考可能的解决方案

关键在于，不是简单地接受或拒绝某个观点，而是批判性地思考它如何适用于我们自己的情境。`

        return hook + rewrittenBody + conclusion
    } else {
        return `Here's an interesting perspective on this topic:\n\n${originalText}\n\nWhat are your thoughts? Let me know in the comments! 👇`
    }
}

// 计算文本相似度（简化版 Jaccard）
function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
}
