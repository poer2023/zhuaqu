// ==================== Structured Logger ====================

export type LogLevel = "debug" | "info" | "warn" | "error"

export type LogContext = {
    traceId?: string     // 通常是 jobId
    stepId?: string
    workerId?: string
    component?: string
    [key: string]: unknown
}

// ==================== Metrics ====================

interface Metrics {
    stepsClaimed: number
    stepsSucceeded: number
    stepsFailed: number
    stepsSkipped: number
    totalProcessingMs: number
    lastResetAt: Date
}

const metrics: Metrics = {
    stepsClaimed: 0,
    stepsSucceeded: 0,
    stepsFailed: 0,
    stepsSkipped: 0,
    totalProcessingMs: 0,
    lastResetAt: new Date(),
}

// ==================== Logger Implementation ====================

function formatLog(level: LogLevel, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString()
    const prefix = context?.traceId ? `[${context.traceId}]` : ""
    const stepPrefix = context?.stepId ? `[step:${context.stepId.slice(0, 8)}]` : ""
    const workerPrefix = context?.workerId ? `[${context.workerId}]` : ""
    const componentPrefix = context?.component ? `[${context.component}]` : ""

    // 结构化 JSON 输出（便于日志收集系统解析）
    const structured = {
        ts: timestamp,
        level,
        msg: message,
        ...context,
    }

    // 开发环境使用可读格式，生产环境使用 JSON
    if (process.env.NODE_ENV === "production") {
        return JSON.stringify(structured)
    }

    return `${timestamp} ${level.toUpperCase().padEnd(5)} ${workerPrefix}${prefix}${stepPrefix}${componentPrefix} ${message}`
}

export const logger = {
    debug(message: string, context?: LogContext): void {
        if (process.env.LOG_LEVEL === "debug") {
            console.log(formatLog("debug", message, context))
        }
    },

    info(message: string, context?: LogContext): void {
        console.log(formatLog("info", message, context))
    },

    warn(message: string, context?: LogContext): void {
        console.warn(formatLog("warn", message, context))
    },

    error(message: string, context?: LogContext): void {
        console.error(formatLog("error", message, context))
    },

    // 带计时的日志
    timed<T>(label: string, fn: () => T | Promise<T>, context?: LogContext): Promise<T> | T {
        const start = Date.now()
        const result = fn()

        if (result instanceof Promise) {
            return result.finally(() => {
                const duration = Date.now() - start
                this.debug(`${label} completed in ${duration}ms`, { ...context, durationMs: duration })
            })
        }

        const duration = Date.now() - start
        this.debug(`${label} completed in ${duration}ms`, { ...context, durationMs: duration })
        return result
    },
}

// ==================== Metrics Functions ====================

export function recordStepClaimed(_processingStartMs: number): void {
    metrics.stepsClaimed++
}

export function recordStepSucceeded(processingMs: number): void {
    metrics.stepsSucceeded++
    metrics.totalProcessingMs += processingMs
}

export function recordStepFailed(processingMs: number): void {
    metrics.stepsFailed++
    metrics.totalProcessingMs += processingMs
}

export function recordStepSkipped(): void {
    metrics.stepsSkipped++
}

export function getMetrics(): Readonly<Metrics> {
    return { ...metrics }
}

export function getAverageProcessingTime(): number {
    const total = metrics.stepsSucceeded + metrics.stepsFailed
    if (total === 0) return 0
    return Math.round(metrics.totalProcessingMs / total)
}

export function resetMetrics(): void {
    metrics.stepsClaimed = 0
    metrics.stepsSucceeded = 0
    metrics.stepsFailed = 0
    metrics.stepsSkipped = 0
    metrics.totalProcessingMs = 0
    metrics.lastResetAt = new Date()
}

// ==================== Metrics Reporter ====================

export function logMetricsSummary(context?: LogContext): void {
    const avgTime = getAverageProcessingTime()
    const uptime = Date.now() - metrics.lastResetAt.getTime()
    const uptimeMin = Math.round(uptime / 60000)

    logger.info(`Metrics: claimed=${metrics.stepsClaimed} succeeded=${metrics.stepsSucceeded} failed=${metrics.stepsFailed} skipped=${metrics.stepsSkipped} avgMs=${avgTime} uptimeMin=${uptimeMin}`, {
        ...context,
        component: "metrics",
        metrics: getMetrics(),
    })
}

// 定期上报 metrics（每 5 分钟）
let metricsInterval: NodeJS.Timeout | null = null

export function startMetricsReporter(intervalMs: number = 300000): void {
    if (metricsInterval) return
    metricsInterval = setInterval(() => {
        logMetricsSummary()
    }, intervalMs)
}

export function stopMetricsReporter(): void {
    if (metricsInterval) {
        clearInterval(metricsInterval)
        metricsInterval = null
    }
}
