/**
 * Tweet Quality Scoring System
 *
 * Evaluates tweet content across multiple dimensions:
 * - Hook: Opening line appeal and attention-grabbing
 * - Clarity: Expression clarity and readability
 * - Engagement: Interaction potential (CTA, questions)
 * - Originality: Uniqueness compared to original
 */

export interface TweetScoreResult {
    hookScore: number          // 1-10
    clarityScore: number       // 1-10
    engagementScore: number    // 1-10
    originalityScore: number   // 1-10
    overallScore: number       // 1-10 weighted average
    analysis: {
        hook: string
        clarity: string
        engagement: string
        originality: string
    }
    suggestions: string[]
    warnings: string[]
}

interface ScoringOptions {
    originalText?: string      // For originality comparison
    targetLength?: number      // Ideal character count
    language?: 'zh' | 'en'
}

// Hook patterns that typically perform well
const STRONG_HOOK_PATTERNS_ZH = [
    /^[【\[].*[】\]]/,           // 【重要】【干货】
    /^(震惊|突发|独家|重磅)/,
    /^(为什么|如何|怎么|什么是)/,
    /^\d+[个种条步招]/,          // 数字开头 "5个方法"
    /^(很少有人知道|99%的人不知道)/,
    /^(刚刚|最新|今天)/,
]

const STRONG_HOOK_PATTERNS_EN = [
    /^(Breaking|Exclusive|Just in)/i,
    /^(Why|How|What|When|Where)/i,
    /^\d+\s+(ways|tips|steps|things)/i,
    /^(Most people don't|Few people)/i,
    /^(Thread|🧵)/i,
]

// Engagement triggers
const ENGAGEMENT_TRIGGERS_ZH = [
    /你觉得|你认为|你怎么看/,
    /评论区|留言|分享/,
    /点赞|转发|收藏/,
    /[？?]$/,                    // Ends with question
    /想了解更多/,
    /关注我|@/,
]

const ENGAGEMENT_TRIGGERS_EN = [
    /what do you think|your thoughts/i,
    /comment|share|retweet/i,
    /like if|rt if/i,
    /\?$/,                       // Ends with question
    /learn more|follow me|@/i,
    /agree or disagree/i,
]

// Warning patterns
const WARNING_PATTERNS = [
    { pattern: /https?:\/\/\S+/g, message: '包含链接（会降低曝光）' },
    { pattern: /#\w+/g, message: '包含话题标签', threshold: 3 },
    { pattern: /@\w+/g, message: '包含 @ 提及', threshold: 2 },
    { pattern: /[\u{1F600}-\u{1F64F}]/gu, message: '包含表情符号', threshold: 5 },
]

/**
 * Calculate text similarity using Jaccard index
 */
function calculateSimilarity(text1: string, text2: string): number {
    if (!text1 || !text2) return 0

    const words1 = new Set(text1.toLowerCase().split(/\s+/))
    const words2 = new Set(text2.toLowerCase().split(/\s+/))

    const intersection = new Set([...words1].filter(x => words2.has(x)))
    const union = new Set([...words1, ...words2])

    return intersection.size / union.size
}

/**
 * Calculate readability score based on sentence structure
 */
function calculateReadability(text: string, language: 'zh' | 'en'): number {
    if (!text) return 0

    // Sentence count
    const sentences = text.split(/[。！？.!?]+/).filter(s => s.trim())
    const avgSentenceLength = text.length / Math.max(sentences.length, 1)

    // Ideal sentence length: 15-40 chars for Chinese, 10-20 words for English
    let score = 10

    if (language === 'zh') {
        if (avgSentenceLength < 10) score -= 2  // Too short
        if (avgSentenceLength > 60) score -= 3  // Too long
        if (avgSentenceLength > 80) score -= 2  // Way too long
    } else {
        const avgWordCount = avgSentenceLength / 5  // Rough estimate
        if (avgWordCount < 5) score -= 2
        if (avgWordCount > 25) score -= 3
        if (avgWordCount > 35) score -= 2
    }

    // Paragraph breaks improve readability
    const hasBreaks = /\n\n/.test(text)
    if (hasBreaks) score += 1

    return Math.max(1, Math.min(10, score))
}

/**
 * Score the hook (opening line)
 */
function scoreHook(text: string, language: 'zh' | 'en'): { score: number; analysis: string } {
    if (!text) return { score: 1, analysis: '无内容' }

    const firstLine = text.split(/[\n。.]/)[0] || text.slice(0, 50)
    let score = 5  // Base score
    const patterns = language === 'zh' ? STRONG_HOOK_PATTERNS_ZH : STRONG_HOOK_PATTERNS_EN

    // Check for strong hook patterns
    for (const pattern of patterns) {
        if (pattern.test(firstLine)) {
            score += 2
            break
        }
    }

    // Short, punchy openings are better
    if (firstLine.length < 30) score += 1
    if (firstLine.length > 80) score -= 1

    // Starts with number or emoji (attention-grabbing)
    if (/^[\d🔥💡🚀✨]/.test(firstLine)) score += 1

    const analysis = score >= 7
        ? '开头有吸引力，能快速抓住注意力'
        : score >= 5
            ? '开头中规中矩，可以更有冲击力'
            : '开头较平淡，建议增加悬念或数据'

    return { score: Math.max(1, Math.min(10, score)), analysis }
}

/**
 * Score engagement potential
 */
function scoreEngagement(text: string, language: 'zh' | 'en'): { score: number; analysis: string } {
    if (!text) return { score: 1, analysis: '无内容' }

    let score = 4  // Base score
    const triggers = language === 'zh' ? ENGAGEMENT_TRIGGERS_ZH : ENGAGEMENT_TRIGGERS_EN

    // Check for engagement triggers
    let triggerCount = 0
    for (const pattern of triggers) {
        if (pattern.test(text)) {
            triggerCount++
            score += 1
        }
    }

    // Questions encourage replies
    const questionCount = (text.match(/[？?]/g) || []).length
    if (questionCount > 0) score += Math.min(questionCount, 2)

    // CTA at the end
    const lastLine = text.split(/\n/).pop() || ''
    if (/关注|follow|转发|retweet|点赞|like/i.test(lastLine)) {
        score += 1
    }

    const analysis = score >= 7
        ? '互动潜力高，有明确的互动引导'
        : score >= 5
            ? '有一定互动性，可增加提问或CTA'
            : '互动性较弱，建议增加问题或行动号召'

    return { score: Math.max(1, Math.min(10, score)), analysis }
}

/**
 * Detect warnings in content
 */
function detectWarnings(text: string): string[] {
    const warnings: string[] = []

    for (const { pattern, message, threshold } of WARNING_PATTERNS) {
        const matches = text.match(pattern) || []
        if (threshold) {
            if (matches.length >= threshold) {
                warnings.push(`${message}（${matches.length}个，可能过多）`)
            }
        } else if (matches.length > 0) {
            warnings.push(message)
        }
    }

    // Character count warning
    if (text.length > 280) {
        warnings.push(`超出 280 字符限制（当前 ${text.length} 字符）`)
    } else if (text.length > 250) {
        warnings.push(`接近 280 字符限制（当前 ${text.length} 字符）`)
    }

    return warnings
}

/**
 * Generate improvement suggestions
 */
function generateSuggestions(
    text: string,
    hookScore: number,
    clarityScore: number,
    engagementScore: number,
    originalityScore: number,
    language: 'zh' | 'en'
): string[] {
    const suggestions: string[] = []

    if (hookScore < 6) {
        suggestions.push(language === 'zh'
            ? '尝试用数字、问题或悬念开头，增加吸引力'
            : 'Try starting with a number, question, or hook to grab attention')
    }

    if (clarityScore < 6) {
        suggestions.push(language === 'zh'
            ? '句子过长，建议拆分以提高可读性'
            : 'Sentences are too long, consider breaking them up')
    }

    if (engagementScore < 6) {
        suggestions.push(language === 'zh'
            ? '添加问题或CTA（行动号召）以提高互动'
            : 'Add a question or CTA to encourage engagement')
    }

    if (originalityScore < 6) {
        suggestions.push(language === 'zh'
            ? '内容与原文相似度较高，建议增加独特观点'
            : 'Content is similar to original, add unique perspective')
    }

    // Length-based suggestions
    if (text.length < 100) {
        suggestions.push(language === 'zh'
            ? '内容较短，可以增加细节或例子'
            : 'Content is short, consider adding details or examples')
    }

    return suggestions
}

/**
 * Main scoring function
 */
export function scoreTweet(text: string, options: ScoringOptions = {}): TweetScoreResult {
    const { originalText, language = 'zh' } = options

    // Individual scores
    const hookResult = scoreHook(text, language)
    const clarityScore = calculateReadability(text, language)
    const engagementResult = scoreEngagement(text, language)

    // Originality score (if original text provided)
    let originalityScore = 8  // Default high if no comparison
    let originalityAnalysis = '无原文对比'

    if (originalText) {
        const similarity = calculateSimilarity(text, originalText)
        originalityScore = Math.round((1 - similarity) * 10)
        originalityAnalysis = similarity < 0.3
            ? '与原文差异大，原创度高'
            : similarity < 0.5
                ? '有一定改写，但仍有相似之处'
                : '与原文相似度较高，建议增加原创观点'
    }

    // Weighted overall score
    const overallScore = Math.round(
        (hookResult.score * 0.25) +
        (clarityScore * 0.20) +
        (engagementResult.score * 0.30) +
        (originalityScore * 0.25)
    )

    // Generate warnings and suggestions
    const warnings = detectWarnings(text)
    const suggestions = generateSuggestions(
        text,
        hookResult.score,
        clarityScore,
        engagementResult.score,
        originalityScore,
        language
    )

    return {
        hookScore: hookResult.score,
        clarityScore,
        engagementScore: engagementResult.score,
        originalityScore,
        overallScore: Math.max(1, Math.min(10, overallScore)),
        analysis: {
            hook: hookResult.analysis,
            clarity: clarityScore >= 7
                ? '表达清晰，易于阅读'
                : clarityScore >= 5
                    ? '可读性一般，部分句子较长'
                    : '可读性较低，建议简化句式',
            engagement: engagementResult.analysis,
            originality: originalityAnalysis,
        },
        suggestions,
        warnings,
    }
}

/**
 * Batch score multiple tweets
 */
export function scoreTweets(
    tweets: Array<{ id: string; text: string; originalText?: string }>,
    options: Omit<ScoringOptions, 'originalText'> = {}
): Array<{ id: string; score: TweetScoreResult }> {
    return tweets.map(({ id, text, originalText }) => ({
        id,
        score: scoreTweet(text, { ...options, originalText }),
    }))
}
