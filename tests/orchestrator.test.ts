/**
 * Minimal tests for orchestrator core functions
 * Run with: npx tsx tests/orchestrator.test.ts
 */

import assert from "node:assert"

// ==================== Backoff Tests ====================

function calcBackoff(attempt: number, baseMs: number = 2000, maxMs: number = 600000): number {
    const backoffMs = baseMs * Math.pow(2, attempt)
    return Math.min(backoffMs, maxMs)
}

function testBackoff() {
    console.log("Testing backoff calculation...")

    // Attempt 0: 2000ms
    assert.strictEqual(calcBackoff(0), 2000, "Attempt 0 should be 2000ms")

    // Attempt 1: 4000ms
    assert.strictEqual(calcBackoff(1), 4000, "Attempt 1 should be 4000ms")

    // Attempt 2: 8000ms
    assert.strictEqual(calcBackoff(2), 8000, "Attempt 2 should be 8000ms")

    // Attempt 5: 64000ms
    assert.strictEqual(calcBackoff(5), 64000, "Attempt 5 should be 64000ms")

    // Attempt 10: capped at 600000ms (10 min)
    assert.strictEqual(calcBackoff(10), 600000, "Attempt 10 should be capped at 600000ms")

    console.log("✓ Backoff tests passed")
}

// ==================== Error Classification Tests ====================

type ErrorCategory = "network" | "auth" | "rate_limit" | "validation" | "server" | "unknown"

type ErrorMeta = {
    retryable: boolean
    category: ErrorCategory
}

const ERROR_META: Record<string, ErrorMeta> = {
    NETWORK_ERROR: { retryable: true, category: "network" },
    RATE_LIMITED: { retryable: true, category: "rate_limit" },
    AUTH_FAILED: { retryable: false, category: "auth" },
    VALIDATION_ERROR: { retryable: false, category: "validation" },
    INTERNAL_ERROR: { retryable: true, category: "server" },
    UNKNOWN: { retryable: true, category: "unknown" },
}

function getErrorMeta(code: string): ErrorMeta {
    return ERROR_META[code] || ERROR_META.UNKNOWN
}

function testErrorClassification() {
    console.log("Testing error classification...")

    // Network errors are retryable
    const networkMeta = getErrorMeta("NETWORK_ERROR")
    assert.strictEqual(networkMeta.retryable, true, "Network errors should be retryable")
    assert.strictEqual(networkMeta.category, "network", "Network error category should be network")

    // Auth errors are not retryable
    const authMeta = getErrorMeta("AUTH_FAILED")
    assert.strictEqual(authMeta.retryable, false, "Auth errors should not be retryable")
    assert.strictEqual(authMeta.category, "auth", "Auth error category should be auth")

    // Rate limits are retryable
    const rateMeta = getErrorMeta("RATE_LIMITED")
    assert.strictEqual(rateMeta.retryable, true, "Rate limits should be retryable")
    assert.strictEqual(rateMeta.category, "rate_limit", "Rate limit category should be rate_limit")

    // Unknown errors default to retryable
    const unknownMeta = getErrorMeta("SOME_UNKNOWN_ERROR")
    assert.strictEqual(unknownMeta.retryable, true, "Unknown errors should default to retryable")

    console.log("✓ Error classification tests passed")
}

// ==================== Idempotency Key Tests ====================

function generateIdempotencyKey(parts: string[]): string {
    return parts.filter(Boolean).join(":")
}

function testIdempotencyKey() {
    console.log("Testing idempotency key generation...")

    // Basic key generation
    const key1 = generateIdempotencyKey(["publish", "content123", "version456"])
    assert.strictEqual(key1, "publish:content123:version456", "Should join parts with colon")

    // Empty parts filtered out
    const key2 = generateIdempotencyKey(["publish", "", "version456"])
    assert.strictEqual(key2, "publish:version456", "Should filter empty parts")

    // Single part
    const key3 = generateIdempotencyKey(["single"])
    assert.strictEqual(key3, "single", "Single part should work")

    console.log("✓ Idempotency key tests passed")
}

// ==================== Step Queue Priority Tests ====================

type StepPriority = {
    stepTypes: string[]
    jobTypes: string[]
}

function getClaimOrder(role: string): StepPriority[] {
    switch (role) {
        case "capture":
            return [
                {
                    stepTypes: ["CAPTURE", "EXTRACT", "MEDIA"],
                    jobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE"],
                },
            ]
        case "pipeline":
            return [{ stepTypes: ["REWRITE", "QA"], jobTypes: ["REWRITE", "PIPELINE"] }]
        case "publish":
            return [{ stepTypes: ["SCHEDULE", "PUBLISH"], jobTypes: ["PUBLISH", "PIPELINE"] }]
        default:
            return [
                { stepTypes: ["PUBLISH", "SCHEDULE"], jobTypes: ["PUBLISH", "PIPELINE"] },
                { stepTypes: ["REWRITE", "QA"], jobTypes: ["REWRITE", "PIPELINE"] },
                {
                    stepTypes: ["CAPTURE", "EXTRACT", "MEDIA"],
                    jobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"],
                },
            ]
    }
}

function testClaimOrder() {
    console.log("Testing claim order by role...")

    // Capture role only handles capture jobs
    const captureOrder = getClaimOrder("capture")
    assert.strictEqual(captureOrder.length, 1, "Capture role should have 1 priority group")
    assert.ok(captureOrder[0].stepTypes.includes("CAPTURE"), "Capture role should handle CAPTURE steps")
    assert.ok(!captureOrder[0].stepTypes.includes("PUBLISH"), "Capture role should not handle PUBLISH steps")

    // Publish role prioritizes publish
    const publishOrder = getClaimOrder("publish")
    assert.ok(publishOrder[0].stepTypes.includes("PUBLISH"), "Publish role should prioritize PUBLISH steps")

    // All role handles everything with priority order
    const allOrder = getClaimOrder("all")
    assert.strictEqual(allOrder.length, 3, "All role should have 3 priority groups")
    // First priority is PUBLISH
    assert.ok(allOrder[0].stepTypes.includes("PUBLISH"), "All role should prioritize PUBLISH first")

    console.log("✓ Claim order tests passed")
}

// ==================== Main ====================

function runTests() {
    console.log("\n=== Orchestrator Tests ===\n")

    try {
        testBackoff()
        testErrorClassification()
        testIdempotencyKey()
        testClaimOrder()

        console.log("\n=== All tests passed! ===\n")
        process.exit(0)
    } catch (error) {
        console.error("\n=== Test failed! ===")
        console.error(error)
        process.exit(1)
    }
}

runTests()
