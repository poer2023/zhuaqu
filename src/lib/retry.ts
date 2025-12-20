/**
 * Retry Utility with Exponential Backoff
 * Provides robust error handling with configurable retry logic
 */

/**
 * Error types that can be retried
 */
export class RetryableError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message)
        this.name = "RetryableError"
    }
}

/**
 * Error types that should not be retried
 */
export class NonRetryableError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message)
        this.name = "NonRetryableError"
    }
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
    // Explicit RetryableError
    if (error instanceof RetryableError) return true

    // Explicit NonRetryableError
    if (error instanceof NonRetryableError) return false

    if (error instanceof Error) {
        const message = error.message.toLowerCase()
        const name = error.name.toLowerCase()

        // Network errors are usually retryable
        if (
            name.includes("network") ||
            name.includes("timeout") ||
            name.includes("econnreset") ||
            name.includes("econnrefused") ||
            name.includes("socket")
        ) {
            return true
        }

        // Rate limit errors are retryable
        if (
            message.includes("rate limit") ||
            message.includes("too many requests") ||
            message.includes("429")
        ) {
            return true
        }

        // Server errors (5xx) are usually retryable
        if (
            message.includes("500") ||
            message.includes("502") ||
            message.includes("503") ||
            message.includes("504") ||
            message.includes("internal server error") ||
            message.includes("bad gateway") ||
            message.includes("service unavailable")
        ) {
            return true
        }

        // Auth errors are not retryable
        if (
            message.includes("401") ||
            message.includes("403") ||
            message.includes("unauthorized") ||
            message.includes("forbidden") ||
            message.includes("invalid api key")
        ) {
            return false
        }

        // Validation errors are not retryable
        if (
            message.includes("400") ||
            message.includes("bad request") ||
            message.includes("invalid") ||
            message.includes("validation")
        ) {
            return false
        }
    }

    // Default: assume it's retryable for resilience
    return true
}

export type RetryOptions = {
    maxAttempts?: number
    baseDelayMs?: number
    maxDelayMs?: number
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

const DEFAULT_OPTIONS: Required<Omit<RetryOptions, "onRetry">> = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
}

/**
 * Calculate exponential backoff delay with jitter
 */
function calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    // Exponential backoff: baseDelay * 2^(attempt-1)
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)

    // Add jitter (±25%)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)

    // Cap at max delay
    return Math.min(exponentialDelay + jitter, maxDelayMs)
}

/**
 * Execute a function with retry logic and exponential backoff
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxAttempts, baseDelayMs, maxDelayMs } = { ...DEFAULT_OPTIONS, ...options }
    const { onRetry } = options

    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            // Don't retry if it's not a retryable error
            if (!isRetryableError(error)) {
                throw error
            }

            // Don't retry if we've exhausted attempts
            if (attempt === maxAttempts) {
                throw error
            }

            // Calculate delay and wait
            const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)

            if (onRetry) {
                onRetry(attempt, error, delayMs)
            }

            await new Promise(resolve => setTimeout(resolve, delayMs))
        }
    }

    // Should never reach here, but TypeScript needs this
    throw lastError
}

/**
 * Wrap a function to make it automatically retry
 */
export function withRetryWrapper<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options: RetryOptions = {}
): (...args: TArgs) => Promise<TResult> {
    return (...args: TArgs) => withRetry(() => fn(...args), options)
}
