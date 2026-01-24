import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { createGoogleGenerativeAI } from "@ai-sdk/google"
import { generateText } from "ai"

const google = createGoogleGenerativeAI({
    apiKey: process.env.GOOGLE_API_KEY || "",
})

// POST /api/brand-voice/[id]/analyze - Analyze sample tweets and generate style profile
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const brandVoice = await prisma.brandVoice.findUnique({
            where: { id },
        })

        if (!brandVoice) {
            return NextResponse.json(
                { error: "Brand voice not found" },
                { status: 404 }
            )
        }

        const sampleTweets = brandVoice.sampleTweets as string[]

        if (!sampleTweets || sampleTweets.length < 3) {
            return NextResponse.json(
                { error: "At least 3 sample tweets are required for analysis" },
                { status: 400 }
            )
        }

        // Analyze the samples using AI
        const analysisPrompt = `你是一个专业的文案风格分析师。请分析以下推文样本，提取作者的写作风格特征。

## 推文样本
${sampleTweets.map((t, i) => `${i + 1}. ${t}`).join("\n\n")}

## 分析要求
请从以下维度分析这些推文的风格特征，输出JSON格式：

{
  "tone": {
    "primary": "主要语调（如：专业、幽默、犀利、温和、激情等）",
    "secondary": "次要语调",
    "formality": "正式程度（1-5，1最口语化，5最正式）"
  },
  "vocabulary": {
    "complexity": "词汇复杂度（1-5）",
    "techTerms": ["常用的专业术语或行业词汇"],
    "signatures": ["标志性用语或口头禅"],
    "emoji_usage": "emoji使用频率（none/rare/moderate/frequent）"
  },
  "patterns": {
    "sentenceLength": "句子长度偏好（short/medium/long/varied）",
    "structure": "常见结构（如：问题-答案、故事-观点、数据-结论等）",
    "hooks": ["常用的开头方式"],
    "endings": ["常用的结尾方式"]
  },
  "personality": {
    "traits": ["3-5个性格特征词"],
    "expertise": ["展现的专业领域"],
    "values": ["传递的价值观"]
  }
}

只输出JSON，不要其他内容。`

        const { text: analysisResult } = await generateText({
            model: google("gemini-2.0-flash"),
            prompt: analysisPrompt,
        })

        // Parse the analysis result
        let styleProfile
        try {
            // Extract JSON from the response
            const jsonMatch = analysisResult.match(/\{[\s\S]*\}/)
            if (jsonMatch) {
                styleProfile = JSON.parse(jsonMatch[0])
            } else {
                throw new Error("No JSON found in response")
            }
        } catch {
            console.error("Failed to parse style analysis:", analysisResult)
            return NextResponse.json(
                { error: "Failed to parse style analysis" },
                { status: 500 }
            )
        }

        // Generate system prompt based on the analysis
        const systemPromptGeneration = `基于以下风格分析结果，生成一个用于AI改写的系统提示词。
这个提示词将指导AI以相同的风格改写内容。

## 风格分析
${JSON.stringify(styleProfile, null, 2)}

## 原始样本
${sampleTweets.slice(0, 3).map((t, i) => `${i + 1}. ${t}`).join("\n")}

## 要求
生成一个简洁有力的系统提示词（200-400字），包含：
1. 角色定位
2. 语调风格要求
3. 结构和格式偏好
4. 用词特点
5. 禁止事项

直接输出提示词文本，不需要额外解释。`

        const { text: systemPrompt } = await generateText({
            model: google("gemini-2.0-flash"),
            prompt: systemPromptGeneration,
        })

        // Update the brand voice with analysis results
        const updatedBrandVoice = await prisma.brandVoice.update({
            where: { id },
            data: {
                styleProfile,
                systemPrompt: systemPrompt.trim(),
            },
        })

        return NextResponse.json({
            brandVoice: updatedBrandVoice,
            analysis: {
                styleProfile,
                systemPrompt: systemPrompt.trim(),
            },
        })
    } catch (error) {
        console.error("Failed to analyze brand voice:", error)
        return NextResponse.json(
            { error: "Failed to analyze brand voice" },
            { status: 500 }
        )
    }
}
