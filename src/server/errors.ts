// ==================== Error Categories for DLQ ====================

export type ErrorCategory =
  | "network"      // 网络错误，通常可重试
  | "auth"         // 认证错误，需人工干预
  | "rate_limit"   // 限流，可延迟重试
  | "validation"   // 参数校验，不可重试
  | "internal"     // 内部错误
  | "timeout"      // 超时错误，可重试
  | "unknown"      // 未知错误

export interface ErrorMeta {
  code: string
  message: string
  retryable: boolean
  category: ErrorCategory
}

// 错误码元数据映射
const ERROR_META: Record<string, Partial<ErrorMeta>> = {
  // 发布相关
  "PUBLISH_TWEET_FAILED": { retryable: true, category: "network" },
  "PUBLISH_TWEET_UNKNOWN": { retryable: false, category: "unknown" },
  "PUBLISH_THREAD_FAILED": { retryable: true, category: "network" },
  "PUBLISH_THREAD_UNKNOWN": { retryable: false, category: "unknown" },
  "PUBLISH_CONTENT_EMPTY": { retryable: false, category: "validation" },
  "PUBLISH_JOB_ID_MISSING": { retryable: false, category: "validation" },
  "PUBLISH_JOB_NOT_FOUND": { retryable: false, category: "validation" },

  // 同步相关
  "SYNC_JOB_NOT_FOUND": { retryable: false, category: "validation" },
  "SYNC_PARTIAL_FAILED": { retryable: true, category: "network" },
  "SYNC_SESSION_EXPIRED": { retryable: false, category: "auth" },

  // 采集相关
  "INGEST_JOB_NOT_FOUND": { retryable: false, category: "validation" },
  "INGEST_URL_INVALID": { retryable: false, category: "validation" },
  "INGEST_FETCH_FAILED": { retryable: true, category: "network" },

  // 改写相关
  "REWRITE_CONTENT_MISSING": { retryable: false, category: "validation" },
  "REWRITE_API_ERROR": { retryable: true, category: "network" },

  // 通用
  "RATE_LIMIT": { retryable: true, category: "rate_limit" },
  "AUTH_EXPIRED": { retryable: false, category: "auth" },
  "LEASE_EXPIRED": { retryable: true, category: "timeout" },
  "WORKER_SHUTDOWN": { retryable: true, category: "internal" },
  "STEP_NOT_SUPPORTED": { retryable: false, category: "validation" },
  "UNKNOWN_ERROR": { retryable: false, category: "unknown" },
}

// ==================== App Error Class ====================

export class AppError extends Error {
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

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code
  return "UNKNOWN_ERROR"
}

export function isRetryableError(error: unknown): boolean {
  if (error instanceof AppError) return error.retryable
  const code = getErrorCode(error)
  return ERROR_META[code]?.retryable ?? false
}

export function getErrorCategory(error: unknown): ErrorCategory {
  if (error instanceof AppError) return error.category
  const code = getErrorCode(error)
  return ERROR_META[code]?.category ?? "unknown"
}

export function getErrorMeta(error: unknown): ErrorMeta {
  const code = getErrorCode(error)
  const message = getErrorMessage(error)
  const meta = ERROR_META[code] ?? {}

  return {
    code,
    message,
    retryable: meta.retryable ?? false,
    category: meta.category ?? "unknown",
  }
}
