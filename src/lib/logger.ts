/**
 * Structured Logger using Pino
 * Provides consistent, performant logging across the application
 */

import pino from "pino"

const isDevelopment = process.env.NODE_ENV === "development"

export const logger = pino({
    level: process.env.LOG_LEVEL || "info",
    ...(isDevelopment && {
        transport: {
            target: "pino-pretty",
            options: {
                colorize: true,
                translateTime: "SYS:standard",
                ignore: "pid,hostname",
            },
        },
    }),
})

/**
 * Create a child logger with context
 */
export function createLogger(context: Record<string, unknown>) {
    return logger.child(context)
}

/**
 * Job-specific logger
 */
export function jobLogger(jobId: string, type?: string) {
    return logger.child({ jobId, type })
}

/**
 * Step-specific logger
 */
export function stepLogger(stepId: string, jobId: string, stepType?: string) {
    return logger.child({ stepId, jobId, stepType })
}

/**
 * API request logger
 */
export function apiLogger(endpoint: string, method: string) {
    return logger.child({ endpoint, method })
}

export default logger
