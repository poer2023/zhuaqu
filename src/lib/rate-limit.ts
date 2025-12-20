/**
 * Memory-based Rate Limiter
 * Simple, zero-dependency rate limiting for API routes
 */

type RateLimitRecord = {
    count: number
    resetAt: number
}

// In-memory store (resets on server restart, suitable for single-instance)
const store = new Map<string, RateLimitRecord>()

// Cleanup old entries periodically (every 5 minutes)
let lastCleanup = Date.now()
const CLEANUP_INTERVAL = 5 * 60 * 1000

function cleanup() {
    const now = Date.now()
    if (now - lastCleanup < CLEANUP_INTERVAL) return

    lastCleanup = now
    const keysToDelete: string[] = []

    store.forEach((record, key) => {
        if (record.resetAt < now) {
            keysToDelete.push(key)
        }
    })

    keysToDelete.forEach(key => store.delete(key))
}

export type RateLimitConfig = {
    /** Maximum number of requests allowed in the window */
    limit: number
    /** Window size in seconds */
    windowSeconds: number
}

export type RateLimitResult = {
    success: boolean
    limit: number
    remaining: number
    resetAt: number
}

/**
 * Check rate limit for a given identifier
 * @param identifier - Unique identifier (e.g., IP address, user ID)
 * @param config - Rate limit configuration
 */
export function checkRateLimit(
    identifier: string,
    config: RateLimitConfig
): RateLimitResult {
    cleanup()

    const now = Date.now()
    const windowMs = config.windowSeconds * 1000

    let record = store.get(identifier)

    // Create new record if doesn't exist or has expired
    if (!record || record.resetAt < now) {
        record = {
            count: 0,
            resetAt: now + windowMs,
        }
    }

    // Increment count
    record.count++
    store.set(identifier, record)

    const remaining = Math.max(0, config.limit - record.count)
    const success = record.count <= config.limit

    return {
        success,
        limit: config.limit,
        remaining,
        resetAt: record.resetAt,
    }
}

/**
 * Rate limiter middleware helper for API routes
 */
export function createRateLimiter(config: RateLimitConfig) {
    return (identifier: string) => checkRateLimit(identifier, config)
}

// Pre-configured rate limiters
export const defaultApiLimiter = createRateLimiter({
    limit: 60,
    windowSeconds: 60,
})

export const strictApiLimiter = createRateLimiter({
    limit: 10,
    windowSeconds: 60,
})

export const authApiLimiter = createRateLimiter({
    limit: 5,
    windowSeconds: 60,
})
