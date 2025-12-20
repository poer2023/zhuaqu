/**
 * Tests for error handling utilities
 * Run with: npx tsx tests/errors.test.ts
 */

import assert from "node:assert"

// ==================== Error Categories ====================

type ErrorCategory =
    | "network"
    | "auth"
    | "rate_limit"
    | "validation"
    | "internal"
    | "timeout"
    | "unknown"

interface ErrorMeta {
    code: string
    message: string
    retryable: boolean
    category: ErrorCategory
}

const ERROR_META: Record<string, Partial<ErrorMeta>> = {
    "PUBLISH_TWEET_FAILED": { retryable: true, category: "network" },
    "PUBLISH_CONTENT_EMPTY": { retryable: false, category: "validation" },
    "SYNC_SESSION_EXPIRED": { retryable: false, category: "auth" },
    "RATE_LIMIT": { retryable: true, category: "rate_limit" },
    "LEASE_EXPIRED": { retryable: true, category: "timeout" },
    "UNKNOWN_ERROR": { retryable: false, category: "unknown" },
}

// ==================== AppError Class ====================

class AppError extends Error {
    readonly code: string
    readonly cause?: unknown
    readonly retryable: boolean
    readonly category: ErrorCategory

    constructor(code: string, message: string, cause?: unknown) {
        super(message)
        this.code = code
        this.cause = cause

        const meta = ERROR_META[code]
        this.retryable = meta?.retryable ?? false
        this.category = meta?.category ?? "unknown"
    }
}

// ==================== Helper Functions ====================

function getErrorMessage(error: unknown): string {
    if (error instanceof Error) return error.message
    return String(error)
}

function getErrorCode(error: unknown): string {
    if (error instanceof AppError) return error.code
    return "UNKNOWN_ERROR"
}

function isRetryableError(error: unknown): boolean {
    if (error instanceof AppError) return error.retryable
    const code = getErrorCode(error)
    return ERROR_META[code]?.retryable ?? false
}

function getErrorCategory(error: unknown): ErrorCategory {
    if (error instanceof AppError) return error.category
    const code = getErrorCode(error)
    return ERROR_META[code]?.category ?? "unknown"
}

// ==================== Tests ====================

function testAppError() {
    console.log("Testing AppError class...")

    // Known error code
    const publishError = new AppError("PUBLISH_TWEET_FAILED", "Failed to publish tweet")
    assert.strictEqual(publishError.code, "PUBLISH_TWEET_FAILED")
    assert.strictEqual(publishError.message, "Failed to publish tweet")
    assert.strictEqual(publishError.retryable, true)
    assert.strictEqual(publishError.category, "network")

    // Validation error (not retryable)
    const validationError = new AppError("PUBLISH_CONTENT_EMPTY", "Content is empty")
    assert.strictEqual(validationError.retryable, false)
    assert.strictEqual(validationError.category, "validation")

    // Unknown error code
    const unknownError = new AppError("SOME_NEW_ERROR", "Something went wrong")
    assert.strictEqual(unknownError.retryable, false)
    assert.strictEqual(unknownError.category, "unknown")

    // Error with cause
    const causedError = new AppError("RATE_LIMIT", "Rate limited", new Error("429"))
    assert.ok(causedError.cause instanceof Error)

    console.log("✓ AppError tests passed")
}

function testGetErrorMessage() {
    console.log("Testing getErrorMessage...")

    // Error instance
    assert.strictEqual(getErrorMessage(new Error("test")), "test")

    // AppError instance
    assert.strictEqual(getErrorMessage(new AppError("TEST", "app error")), "app error")

    // String
    assert.strictEqual(getErrorMessage("string error"), "string error")

    // Number
    assert.strictEqual(getErrorMessage(123), "123")

    // null/undefined
    assert.strictEqual(getErrorMessage(null), "null")
    assert.strictEqual(getErrorMessage(undefined), "undefined")

    console.log("✓ getErrorMessage tests passed")
}

function testGetErrorCode() {
    console.log("Testing getErrorCode...")

    // AppError returns its code
    assert.strictEqual(getErrorCode(new AppError("RATE_LIMIT", "msg")), "RATE_LIMIT")

    // Regular Error returns UNKNOWN_ERROR
    assert.strictEqual(getErrorCode(new Error("test")), "UNKNOWN_ERROR")

    // Non-error returns UNKNOWN_ERROR
    assert.strictEqual(getErrorCode("string"), "UNKNOWN_ERROR")

    console.log("✓ getErrorCode tests passed")
}

function testIsRetryableError() {
    console.log("Testing isRetryableError...")

    // Network error is retryable
    assert.strictEqual(isRetryableError(new AppError("PUBLISH_TWEET_FAILED", "msg")), true)

    // Rate limit is retryable
    assert.strictEqual(isRetryableError(new AppError("RATE_LIMIT", "msg")), true)

    // Validation error is not retryable
    assert.strictEqual(isRetryableError(new AppError("PUBLISH_CONTENT_EMPTY", "msg")), false)

    // Auth error is not retryable
    assert.strictEqual(isRetryableError(new AppError("SYNC_SESSION_EXPIRED", "msg")), false)

    // Regular Error defaults to not retryable
    assert.strictEqual(isRetryableError(new Error("test")), false)

    console.log("✓ isRetryableError tests passed")
}

function testGetErrorCategory() {
    console.log("Testing getErrorCategory...")

    assert.strictEqual(getErrorCategory(new AppError("PUBLISH_TWEET_FAILED", "msg")), "network")
    assert.strictEqual(getErrorCategory(new AppError("RATE_LIMIT", "msg")), "rate_limit")
    assert.strictEqual(getErrorCategory(new AppError("SYNC_SESSION_EXPIRED", "msg")), "auth")
    assert.strictEqual(getErrorCategory(new AppError("LEASE_EXPIRED", "msg")), "timeout")
    assert.strictEqual(getErrorCategory(new Error("test")), "unknown")

    console.log("✓ getErrorCategory tests passed")
}

// ==================== Main ====================

function runTests() {
    console.log("\n=== Error Handling Tests ===\n")

    try {
        testAppError()
        testGetErrorMessage()
        testGetErrorCode()
        testIsRetryableError()
        testGetErrorCategory()

        console.log("\n=== All error tests passed! ===\n")
        process.exit(0)
    } catch (error) {
        console.error("\n=== Test failed! ===")
        console.error(error)
        process.exit(1)
    }
}

runTests()
