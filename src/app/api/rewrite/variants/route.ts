import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
})

// POST /api/rewrite/variants - Generate A/B variants
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            rewriteVersionId,
            variantCount = 3,
            variationDimensions = ["tone", "hook"],
        } = body

        if (!rewriteVersionId) {
            return NextResponse.json(
                { error: "rewriteVersionId is required" },
                { status: 400 }
            )
        }

        // Get original rewrite version
        const rewriteVersion = await prisma.rewriteVersion.findUnique({
            where: { id: rewriteVersionId },
            include: { contentItem: true },
        })

        if (!rewriteVersion) {
            return NextResponse.json(
                { error: "Rewrite version not found" },
                { status: 404 }
            )
        }

        const originalText = (rewriteVersion.output as { text: string })?.text
        if (!originalText) {
            return NextResponse.json(
                { error: "No text content in rewrite version" },
                { status: 400 }
            )
        }

        // Generate variants
        const variantLabels = ["A", "B", "C", "D", "E"].slice(0, variantCount)
        const variants: Array<{
            variantType: string
            variantLabel: string
            content: string
            generationParams: object
        }> = []

        for (let i = 0; i < variantCount; i++) {
            const dimension = variationDimensions[i % variationDimensions.length]
            const label = variantLabels[i]

            const prompt = generateVariantPrompt(originalText, dimension, label)

            const { text } = await generateText({
                model: google("gemini-2.0-flash"),
                prompt,
            })

            variants.push({
                variantType: dimension,
                variantLabel: label,
                content: text.trim(),
                generationParams: { dimension, originalLength: originalText.length },
            })
        }

        // Save variants to database
        const savedVariants = await Promise.all(
            variants.map((v) =>
                prisma.contentVariant.create({
                    data: {
                        rewriteVersionId,
                        variantType: v.variantType,
                        variantLabel: v.variantLabel,
                        content: v.content,
                        generationParams: v.generationParams,
                    },
                })
            )
        )

        return NextResponse.json({
            variants: savedVariants,
            count: savedVariants.length,
        })
    } catch (error) {
        console.error("Failed to generate variants:", error)
        return NextResponse.json(
            { error: "Failed to generate variants" },
            { status: 500 }
        )
    }
}

function generateVariantPrompt(originalText: string, dimension: string, label: string): string {
    const dimensionInstructions: Record<string, string> = {
        tone: `变体 ${label}：调整语气风格
- 如果原文正式，改为更轻松幽默
- 如果原文轻松，改为更专业权威
- 保持核心信息不变`,

        hook: `变体 ${label}：优化开头钩子
- 用完全不同的方式开头
- 可以尝试：数字、问题、悬念、反常识
- 保持核心信息不变`,

        length: `变体 ${label}：调整长度
- 如果原文较长，精简为更短版本
- 如果原文较短，扩展增加细节
- 目标变化 30-50%`,

        cta: `变体 ${label}：优化行动号召
- 添加或修改结尾的互动引导
- 可以是问题、投票、评论邀请
- 让读者有明确的下一步动作`,

        structure: `变体 ${label}：调整结构
- 改变段落顺序或分割方式
- 尝试列表、分段、或连续叙述
- 保持核心信息不变`,
    }

    const instruction = dimensionInstructions[dimension] || dimensionInstructions.tone

    return `你是一个社交媒体内容专家。请根据以下要求创建原文的变体版本。

## 原文
${originalText}

## 变体要求
${instruction}

## 输出要求
- 直接输出变体内容，不要解释
- 保持在 280 字符以内
- 保持原文的核心观点和信息

变体内容：`
}

// GET /api/rewrite/variants - Get variants for a rewrite version
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const rewriteVersionId = searchParams.get("rewriteVersionId")

        if (!rewriteVersionId) {
            return NextResponse.json(
                { error: "rewriteVersionId is required" },
                { status: 400 }
            )
        }

        const variants = await prisma.contentVariant.findMany({
            where: { rewriteVersionId },
            orderBy: { createdAt: "asc" },
        })

        return NextResponse.json({ variants })
    } catch (error) {
        console.error("Failed to fetch variants:", error)
        return NextResponse.json(
            { error: "Failed to fetch variants" },
            { status: 500 }
        )
    }
}
