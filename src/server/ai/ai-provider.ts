/**
 * AI Provider Factory - Unified AI model configuration
 * Provides a single interface to switch between OpenAI and Google Gemini models
 */

import { createOpenAI } from "@ai-sdk/openai"
import { createGoogleGenerativeAI } from "@ai-sdk/google"

export type AIProviderType = "openai" | "gemini"

/**
 * Get the default AI model based on environment configuration
 */
export function getDefaultModel() {
    const provider = (process.env.AI_PROVIDER || "openai") as AIProviderType
    return getModel(provider)
}

/**
 * Get an AI model by provider type
 */
export function getModel(provider: AIProviderType) {
    if (provider === "gemini") {
        const apiKey = process.env.GEMINI_API_KEY?.trim()
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not set")
        }
        const gemini = createGoogleGenerativeAI({ apiKey })
        return gemini(process.env.GEMINI_MODEL || "gemini-1.5-flash")
    }

    // Default to OpenAI
    const apiKey = process.env.OPENAI_API_KEY?.trim()
    if (!apiKey) {
        throw new Error("OPENAI_API_KEY is not set")
    }
    const openaiClient = createOpenAI({ apiKey })
    return openaiClient(process.env.OPENAI_MODEL || "gpt-4o-mini")
}

/**
 * Check if AI is available (has valid API key)
 */
export function isAIAvailable(): boolean {
    const openaiKey = process.env.OPENAI_API_KEY?.trim()
    const geminiKey = process.env.GEMINI_API_KEY?.trim()
    return Boolean(openaiKey || geminiKey)
}

/**
 * Get available provider based on environment
 */
export function getAvailableProvider(): AIProviderType | null {
    if (process.env.OPENAI_API_KEY?.trim()) return "openai"
    if (process.env.GEMINI_API_KEY?.trim()) return "gemini"
    return null
}
