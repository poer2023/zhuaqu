/**
 * Tests for retry utility with exponential backoff
 * Run with: npx tsx tests/retry.test.ts
 */

import assert from "node:assert"

// ==================== Retry Implementation (copied for testing) ====================

class RetryableError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message)
        this.name = "RetryableError"
    }
}

class NonRetryableError extends Error {
    constructor(message: string, public readonly cause?: unknown) {
        super(message)
        this.name = "NonRetryableError"
    }
}

function isRetryableError(error: unknown): boolean {
    if (error instanceof RetryableError) return true
    if (error instanceof NonRetryableError) return false

    if (error instanceof Error) {
        const message = error.message.toLowerCase()

        if (message.includes("rate limit") || message.includes("429")) {
            return true
        }
        if (message.includes("500") || message.includes("503")) {
            return true
        }
        if (message.includes("401") || message.includes("unauthorized")) {
            return false
        }
        if (message.includes("400") || message.includes("invalid")) {
            return false
        }
    }

    return true
}

function calculateBackoffDelay(attempt: number, baseDelayMs: number, maxDelayMs: number): number {
    const exponentialDelay = baseDelayMs * Math.pow(2, attempt - 1)
    const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1)
    return Math.min(exponentialDelay + jitter, maxDelayMs)
}

type RetryOptions = {
    maxAttempts?: number
    baseDelayMs?: number
    maxDelayMs?: number
    onRetry?: (attempt: number, error: unknown, delayMs: number) => void
}

async function withRetry<T>(
    fn: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> {
    const { maxAttempts = 3, baseDelayMs = 1000, maxDelayMs = 30000 } = options
    const { onRetry } = options

    let lastError: unknown

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            return await fn()
        } catch (error) {
            lastError = error

            if (!isRetryableError(error)) {
                throw error
            }

            if (attempt === maxAttempts) {
                throw error
            }

            const delayMs = calculateBackoffDelay(attempt, baseDelayMs, maxDelayMs)

            if (onRetry) {
                onRetry(attempt, error, delayMs)
            }

            await new Promise(resolve => setTimeout(resolve, Math.min(delayMs, 10)))
        }
    }

    throw lastError
}

// ==================== Tests ====================

async function testWithRetrySuccess() {
    console.log("Testing withRetry with successful function...")

    let callCount = 0
    const result = await withRetry(async () => {
        callCount++
        return "success"
    })

    assert.strictEqual(result, "success", "Should return success")
    assert.strictEqual(callCount, 1, "Should only call once on success")

    console.log("✓ withRetry success test passed")
}

async function testWithRetryEventualSuccess() {
    console.log("Testing withRetry with eventual success...")

    let callCount = 0
    const result = await withRetry(async () => {
        callCount++
        if (callCount < 3) {
            throw new Error("Rate limit exceeded")
        }
        return "success"
    }, { baseDelayMs: 1 })

    assert.strictEqual(result, "success", "Should return success after retries")
    assert.strictEqual(callCount, 3, "Should call 3 times")

    console.log("✓ withRetry eventual success test passed")
}

async function testWithRetryMaxAttempts() {
    console.log("Testing withRetry max attempts exhausted...")

    let callCount = 0
    try {
        await withRetry(async () => {
            callCount++
            throw new Error("Rate limit exceeded")
        }, { maxAttempts: 3, baseDelayMs: 1 })
        assert.fail("Should have thrown")
    } catch (error) {
        assert.ok(error instanceof Error, "Should throw Error")
        assert.strictEqual(callCount, 3, "Should try 3 times")
    }

    console.log("✓ withRetry max attempts test passed")
}

async function testWithRetryNonRetryable() {
    console.log("Testing withRetry with non-retryable error...")

    let callCount = 0
    try {
        await withRetry(async () => {
            callCount++
            throw new NonRetryableError("Invalid input")
        }, { baseDelayMs: 1 })
        assert.fail("Should have thrown")
    } catch (error) {
        assert.ok(error instanceof NonRetryableError, "Should throw NonRetryableError")
        assert.strictEqual(callCount, 1, "Should only call once")
    }

    console.log("✓ withRetry non-retryable error test passed")
}

function testIsRetryableError() {
    console.log("Testing isRetryableError...")

    assert.strictEqual(isRetryableError(new RetryableError("test")), true, "RetryableError should be retryable")
    assert.strictEqual(isRetryableError(new NonRetryableError("test")), false, "NonRetryableError should not be retryable")
    assert.strictEqual(isRetryableError(new Error("Rate limit exceeded")), true, "Rate limit should be retryable")
    assert.strictEqual(isRetryableError(new Error("500 Internal Server Error")), true, "500 should be retryable")
    assert.strictEqual(isRetryableError(new Error("401 Unauthorized")), false, "401 should not be retryable")
    assert.strictEqual(isRetryableError(new Error("400 Invalid request")), false, "Invalid request should not be retryable")

    console.log("✓ isRetryableError tests passed")
}

function testCalculateBackoffDelay() {
    console.log("Testing calculateBackoffDelay...")

    // Test exponential growth (with some tolerance for jitter)
    const delay1 = calculateBackoffDelay(1, 1000, 30000)
    assert.ok(delay1 >= 750 && delay1 <= 1250, `Attempt 1 delay ${delay1} should be around 1000ms`)

    const delay2 = calculateBackoffDelay(2, 1000, 30000)
    assert.ok(delay2 >= 1500 && delay2 <= 2500, `Attempt 2 delay ${delay2} should be around 2000ms`)

    const delay3 = calculateBackoffDelay(3, 1000, 30000)
    assert.ok(delay3 >= 3000 && delay3 <= 5000, `Attempt 3 delay ${delay3} should be around 4000ms`)

    // Test max delay cap
    const delayMax = calculateBackoffDelay(10, 1000, 5000)
    assert.ok(delayMax <= 6250, `Delay ${delayMax} should be capped near maxDelayMs`)

    console.log("✓ calculateBackoffDelay tests passed")
}

// ==================== Main ====================

async function runTests() {
    console.log("\n=== Retry Utility Tests ===\n")

    try {
        testIsRetryableError()
        testCalculateBackoffDelay()
        await testWithRetrySuccess()
        await testWithRetryEventualSuccess()
        await testWithRetryMaxAttempts()
        await testWithRetryNonRetryable()

        console.log("\n=== All retry tests passed! ===\n")
        process.exit(0)
    } catch (error) {
        console.error("\n=== Test failed! ===")
        console.error(error)
        process.exit(1)
    }
}

runTests()
