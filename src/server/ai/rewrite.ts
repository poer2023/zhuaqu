/**
 * AI Content Rewriting Module
 * Refactored to use Vercel AI SDK for unified model access
 */

import { generateText, streamText } from "ai"
import { getModel, isAIAvailable, getAvailableProvider } from "./ai-provider"

export type RewriteParams = {
  targetPersona?: string
  audienceTone?: string
  stance?: string
  outputFormat?: string
  language?: string
  includeHook?: boolean
  includeConclusion?: boolean
  includeCTA?: boolean
}

export function buildSystemPrompt(params: Pick<RewriteParams, "targetPersona" | "audienceTone" | "language">): string {
  const persona = params.targetPersona || "专业内容创作者"
  const tone = params.audienceTone || "专业但易懂"
  const language = params.language === "zh" ? "中文" : params.language === "en" ? "英文" : "中文"

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

export function buildUserPrompt(originalText: string, params: Pick<RewriteParams, "stance" | "includeHook" | "includeConclusion" | "includeCTA">): string {
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

function generateMockRewrite(originalText: string, params: { language?: string }): string {
  const isZh = params.language !== "en"

  if (isZh) {
    const hooks = ["💡 一个有趣的观察：", "🔥 值得深思的话题：", "📌 最近在思考一个问题：", "🎯 分享一个重要的洞察："]
    const conclusions = ["\n\n你怎么看这个观点？欢迎讨论 👇", "\n\n这是我的理解，期待不同声音 💬", "\n\n思考比答案更重要 🤔"]

    const hook = hooks[Math.floor(Math.random() * hooks.length)]
    const conclusion = conclusions[Math.floor(Math.random() * conclusions.length)]

    const rewrittenBody = `在当今快速变化的环境中，这个话题变得越来越重要。

原观点提到的核心问题确实值得我们关注。但我想从另一个角度来分析：

1. 首先，我们需要理解背后的深层逻辑
2. 其次，考虑实际应用中的挑战
3. 最后，思考可能的解决方案

关键在于，不是简单地接受或拒绝某个观点，而是批判性地思考它如何适用于我们自己的情境。`

    return hook + rewrittenBody + conclusion
  }

  return `Here's an interesting perspective on this topic:\n\n${originalText}\n\nWhat are your thoughts? Let me know in the comments! 👇`
}

export function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/))
  const words2 = new Set(text2.toLowerCase().split(/\s+/))

  const intersection = new Set([...words1].filter((x) => words2.has(x)))
  const union = new Set([...words1, ...words2])

  return intersection.size / union.size
}

/**
 * Generate rewritten text using AI SDK
 */
export async function generateRewriteText(originalText: string, params: RewriteParams): Promise<string> {
  if (!isAIAvailable()) {
    return generateMockRewrite(originalText, params)
  }

  const provider = getAvailableProvider()
  if (!provider) {
    return generateMockRewrite(originalText, params)
  }

  try {
    const model = getModel(provider)
    const systemPrompt = buildSystemPrompt(params)
    const userPrompt = buildUserPrompt(originalText, params)

    const result = await generateText({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    })

    return result.text || generateMockRewrite(originalText, params)
  } catch (error) {
    console.error("AI rewrite error:", error)
    return generateMockRewrite(originalText, params)
  }
}

/**
 * Stream rewritten text using AI SDK
 */
export async function streamRewriteText(args: {
  originalText: string
  params: RewriteParams
  onDelta: (delta: string) => Promise<void> | void
  flushIntervalMs?: number
}): Promise<{ text: string }> {
  if (!isAIAvailable()) {
    const mock = generateMockRewrite(args.originalText, args.params)
    for (const ch of mock.split("")) {
      await args.onDelta(ch)
      await new Promise((r) => setTimeout(r, 5))
    }
    return { text: mock }
  }

  const provider = getAvailableProvider()
  if (!provider) {
    const mock = generateMockRewrite(args.originalText, args.params)
    for (const ch of mock.split("")) {
      await args.onDelta(ch)
      await new Promise((r) => setTimeout(r, 5))
    }
    return { text: mock }
  }

  try {
    const model = getModel(provider)
    const systemPrompt = buildSystemPrompt(args.params)
    const userPrompt = buildUserPrompt(args.originalText, args.params)

    const result = await streamText({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
    })

    let fullText = ""
    for await (const chunk of result.textStream) {
      if (chunk) {
        fullText += chunk
        await args.onDelta(chunk)
      }
    }

    return { text: fullText }
  } catch (error) {
    console.error("AI stream error:", error)
    const mock = generateMockRewrite(args.originalText, args.params)
    for (const ch of mock.split("")) {
      await args.onDelta(ch)
      await new Promise((r) => setTimeout(r, 5))
    }
    return { text: mock }
  }
}
