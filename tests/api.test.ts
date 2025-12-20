/**
 * Tests for API response patterns
 * Run with: npx tsx tests/api.test.ts
 */

import assert from "node:assert"

// ==================== API Response Patterns ====================

interface ApiSuccessResponse<T> {
    data?: T
    items?: T[]
    pageInfo?: {
        page: number
        limit: number
        total: number
        totalPages: number
        hasMore: boolean
    }
}

interface ApiErrorResponse {
    error: string
    code?: string
    details?: unknown
}

type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

function isErrorResponse(response: ApiResponse<unknown>): response is ApiErrorResponse {
    return "error" in response
}

function createSuccessResponse<T>(data: T): ApiSuccessResponse<T> {
    return { data }
}

function createListResponse<T>(items: T[], page: number, limit: number, total: number): ApiSuccessResponse<T> {
    return {
        items,
        pageInfo: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
            hasMore: page * limit < total,
        },
    }
}

function createErrorResponse(error: string, code?: string): ApiErrorResponse {
    return { error, code }
}

// ==================== Tests ====================

function testSuccessResponse() {
    console.log("Testing success response...")

    const response = createSuccessResponse({ id: "123", name: "Test" })
    assert.ok(!isErrorResponse(response), "Success response should not be error")
    assert.deepStrictEqual(response.data, { id: "123", name: "Test" })

    console.log("✓ Success response tests passed")
}

function testListResponse() {
    console.log("Testing list response...")

    const items = [{ id: "1" }, { id: "2" }, { id: "3" }]
    const response = createListResponse(items, 1, 10, 25)

    assert.ok(!isErrorResponse(response), "List response should not be error")
    assert.strictEqual(response.items?.length, 3)
    assert.strictEqual(response.pageInfo?.page, 1)
    assert.strictEqual(response.pageInfo?.limit, 10)
    assert.strictEqual(response.pageInfo?.total, 25)
    assert.strictEqual(response.pageInfo?.totalPages, 3)
    assert.strictEqual(response.pageInfo?.hasMore, true)

    // Last page
    const lastPage = createListResponse(items, 3, 10, 25)
    assert.strictEqual(lastPage.pageInfo?.hasMore, false)

    console.log("✓ List response tests passed")
}

function testErrorResponse() {
    console.log("Testing error response...")

    const response = createErrorResponse("Not found", "NOT_FOUND")
    assert.ok(isErrorResponse(response), "Error response should be error")
    assert.strictEqual(response.error, "Not found")
    assert.strictEqual(response.code, "NOT_FOUND")

    // Error without code
    const simpleError = createErrorResponse("Something went wrong")
    assert.strictEqual(simpleError.code, undefined)

    console.log("✓ Error response tests passed")
}

function testPaginationCalculation() {
    console.log("Testing pagination calculation...")

    // Empty result
    const empty = createListResponse([], 1, 10, 0)
    assert.strictEqual(empty.pageInfo?.totalPages, 0)
    assert.strictEqual(empty.pageInfo?.hasMore, false)

    // Single page
    const single = createListResponse([1, 2, 3], 1, 10, 3)
    assert.strictEqual(single.pageInfo?.totalPages, 1)
    assert.strictEqual(single.pageInfo?.hasMore, false)

    // Multiple pages
    const multi = createListResponse([1, 2], 1, 2, 5)
    assert.strictEqual(multi.pageInfo?.totalPages, 3)
    assert.strictEqual(multi.pageInfo?.hasMore, true)

    // Exact page boundary
    const exact = createListResponse([1, 2], 2, 2, 4)
    assert.strictEqual(exact.pageInfo?.totalPages, 2)
    assert.strictEqual(exact.pageInfo?.hasMore, false)

    console.log("✓ Pagination calculation tests passed")
}

// ==================== Main ====================

function runTests() {
    console.log("\n=== API Response Tests ===\n")

    try {
        testSuccessResponse()
        testListResponse()
        testErrorResponse()
        testPaginationCalculation()

        console.log("\n=== All API tests passed! ===\n")
        process.exit(0)
    } catch (error) {
        console.error("\n=== Test failed! ===")
        console.error(error)
        process.exit(1)
    }
}

runTests()
