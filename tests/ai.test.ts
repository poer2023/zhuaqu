/**
 * Tests for AI rewrite utilities
 * Run with: npx tsx tests/ai.test.ts
 */

import assert from "node:assert"

// ==================== Similarity Function ====================

function calculateSimilarity(text1: string, text2: string): number {
    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter((x) => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
}

// ==================== Prompt Builders ====================

type RewriteParams = {
    targetPersona?: string
    audienceTone?: string
    stance?: string
    outputFormat?: string
    language?: string
    includeHook?: boolean
    includeConclusion?: boolean
    includeCTA?: boolean
}

function buildSystemPrompt(params: Pick<RewriteParams, "targetPersona" | "audienceTone" | "language">): string {
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

function buildUserPrompt(originalText: string, params: Pick<RewriteParams, "stance" | "includeHook" | "includeConclusion" | "includeCTA">): string {
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

// ==================== Tests ====================

function testCalculateSimilarity() {
    console.log("Testing calculateSimilarity...")

    // Identical texts should have similarity 1.0
    const sim1 = calculateSimilarity("hello world", "hello world")
    assert.strictEqual(sim1, 1.0, "Identical texts should have similarity 1.0")

    // Completely different texts should have similarity 0
    const sim2 = calculateSimilarity("hello world", "foo bar baz")
    assert.strictEqual(sim2, 0, "Completely different texts should have similarity 0")

    // Partial overlap
    const sim3 = calculateSimilarity("hello world test", "hello world different")
    // {"hello", "world", "test"} and {"hello", "world", "different"}
    // intersection: {"hello", "world"} = 2
    // union: {"hello", "world", "test", "different"} = 4
    // similarity = 2/4 = 0.5
    assert.strictEqual(sim3, 0.5, "Partial overlap should have appropriate similarity")

    // Case insensitive
    const sim4 = calculateSimilarity("Hello World", "hello world")
    assert.strictEqual(sim4, 1.0, "Comparison should be case insensitive")

    // Empty strings
    const sim5 = calculateSimilarity("", "")
    assert.ok(!isNaN(sim5), "Empty strings should not produce NaN")

    console.log("✓ calculateSimilarity tests passed")
}

function testBuildSystemPrompt() {
    console.log("Testing buildSystemPrompt...")

    // Default values
    const prompt1 = buildSystemPrompt({})
    assert.ok(prompt1.includes("专业内容创作者"), "Should include default persona")
    assert.ok(prompt1.includes("专业但易懂"), "Should include default tone")
    assert.ok(prompt1.includes("中文"), "Should include default language")

    // Custom persona
    const prompt2 = buildSystemPrompt({ targetPersona: "科技评论员" })
    assert.ok(prompt2.includes("科技评论员"), "Should include custom persona")

    // English language
    const prompt3 = buildSystemPrompt({ language: "en" })
    assert.ok(prompt3.includes("英文"), "Should include English language")

    // Chinese language
    const prompt4 = buildSystemPrompt({ language: "zh" })
    assert.ok(prompt4.includes("中文"), "Should include Chinese language")

    console.log("✓ buildSystemPrompt tests passed")
}

function testBuildUserPrompt() {
    console.log("Testing buildUserPrompt...")

    const originalText = "This is a test post about technology."

    // Default options (hook and conclusion included)
    const prompt1 = buildUserPrompt(originalText, {})
    assert.ok(prompt1.includes(originalText), "Should include original text")
    assert.ok(prompt1.includes("开头要有吸引眼球的钩子"), "Should include hook by default")
    assert.ok(prompt1.includes("结尾要有清晰的总结或观点"), "Should include conclusion by default")

    // With stance
    const prompt2 = buildUserPrompt(originalText, { stance: "agree" })
    assert.ok(prompt2.includes("表达支持和认同的立场"), "Should include agree stance")

    const prompt3 = buildUserPrompt(originalText, { stance: "disagree" })
    assert.ok(prompt3.includes("表达不同意见或反驳的立场"), "Should include disagree stance")

    // With CTA
    const prompt4 = buildUserPrompt(originalText, { includeCTA: true })
    assert.ok(prompt4.includes("添加行动号召或互动引导"), "Should include CTA when enabled")

    // Without hook
    const prompt5 = buildUserPrompt(originalText, { includeHook: false })
    assert.ok(!prompt5.includes("开头要有吸引眼球的钩子"), "Should not include hook when disabled")

    // Without conclusion
    const prompt6 = buildUserPrompt(originalText, { includeConclusion: false })
    assert.ok(!prompt6.includes("结尾要有清晰的总结或观点"), "Should not include conclusion when disabled")

    console.log("✓ buildUserPrompt tests passed")
}

// ==================== Main ====================

function runTests() {
    console.log("\n=== AI Rewrite Tests ===\n")

    try {
        testCalculateSimilarity()
        testBuildSystemPrompt()
        testBuildUserPrompt()

        console.log("\n=== All AI tests passed! ===\n")
        process.exit(0)
    } catch (error) {
        console.error("\n=== Test failed! ===")
        console.error(error)
        process.exit(1)
    }
}

runTests()
