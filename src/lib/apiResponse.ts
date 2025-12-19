import { NextResponse } from "next/server"

/**
 * 标准化 API 错误响应
 */
export interface ApiError {
    code: string
    message: string
    details?: unknown
}

/**
 * 创建错误响应
 */
export function errorResponse(
    code: string,
    message: string,
    status: number = 400,
    details?: unknown
): NextResponse<{ error: ApiError }> {
    return NextResponse.json(
        { error: { code, message, details } },
        { status }
    )
}

/**
 * 创建成功响应
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse<T> {
    return NextResponse.json(data, { status })
}

/**
 * 常用错误码
 */
export const ErrorCodes = {
    // 客户端错误 (4xx)
    BAD_REQUEST: "BAD_REQUEST",
    UNAUTHORIZED: "UNAUTHORIZED",
    FORBIDDEN: "FORBIDDEN",
    NOT_FOUND: "NOT_FOUND",
    CONFLICT: "CONFLICT",
    VALIDATION_ERROR: "VALIDATION_ERROR",

    // 服务端错误 (5xx)
    INTERNAL_ERROR: "INTERNAL_ERROR",
    DATABASE_ERROR: "DATABASE_ERROR",
    EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const

/**
 * 封装 API 路由处理器，统一错误处理
 */
export function withErrorHandler<T>(
    handler: () => Promise<NextResponse<T>>
): Promise<NextResponse<T | { error: ApiError }>> {
    return handler().catch((error: unknown) => {
        console.error("API Error:", error)

        const message = error instanceof Error ? error.message : "An unexpected error occurred"
        const code = (error as { code?: string })?.code ?? ErrorCodes.INTERNAL_ERROR

        return errorResponse(code, message, 500)
    })
}

/**
 * 验证必填字段
 */
export function validateRequired(
    body: Record<string, unknown>,
    fields: string[]
): { valid: true } | { valid: false; response: NextResponse<{ error: ApiError }> } {
    const missing = fields.filter(f => body[f] === undefined || body[f] === null)

    if (missing.length > 0) {
        return {
            valid: false,
            response: errorResponse(
                ErrorCodes.VALIDATION_ERROR,
                `Missing required fields: ${missing.join(", ")}`,
                400
            )
        }
    }

    return { valid: true }
}
