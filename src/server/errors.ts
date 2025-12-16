export class AppError extends Error {
  readonly code: string
  readonly cause?: unknown

  constructor(code: string, message: string, cause?: unknown) {
    super(message)
    this.code = code
    this.cause = cause
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

export function getErrorCode(error: unknown): string {
  if (error instanceof AppError) return error.code
  return "UNKNOWN_ERROR"
}

