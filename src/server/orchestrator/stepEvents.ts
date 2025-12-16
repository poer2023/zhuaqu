import prisma from "@/lib/prisma"
import type { Prisma, StepEvent } from "@prisma/client"

// ==================== Step Event Types ====================

export type StepEventType = "log" | "progress" | "output" | "error"

export interface LogEventData {
    message: string
    level?: "info" | "warn" | "error" | "debug"
    at: string
}

export interface ProgressEventData {
    current: number
    total: number
    message?: string
}

export interface OutputEventData {
    delta: string
    position?: number
}

export interface ErrorEventData {
    code: string
    message: string
    retryable?: boolean
    category?: string
}

// ==================== Append Functions ====================

export async function appendStepLog(
    stepId: string,
    message: string,
    level: "info" | "warn" | "error" | "debug" = "info"
): Promise<StepEvent> {
    const data: LogEventData = {
        message,
        level,
        at: new Date().toISOString(),
    }

    return prisma.stepEvent.create({
        data: {
            stepId,
            type: "log",
            data: data as unknown as Prisma.InputJsonValue,
        },
    })
}

export async function appendStepOutput(
    stepId: string,
    delta: string,
    position?: number
): Promise<StepEvent> {
    const data: OutputEventData = { delta, position }

    return prisma.stepEvent.create({
        data: {
            stepId,
            type: "output",
            data: data as unknown as Prisma.InputJsonValue,
        },
    })
}

export async function appendStepProgress(
    stepId: string,
    current: number,
    total: number,
    message?: string
): Promise<StepEvent> {
    const data: ProgressEventData = { current, total, message }

    return prisma.stepEvent.create({
        data: {
            stepId,
            type: "progress",
            data: data as unknown as Prisma.InputJsonValue,
        },
    })
}

export async function appendStepError(
    stepId: string,
    code: string,
    message: string,
    retryable?: boolean,
    category?: string
): Promise<StepEvent> {
    const data: ErrorEventData = { code, message, retryable, category }

    return prisma.stepEvent.create({
        data: {
            stepId,
            type: "error",
            data: data as unknown as Prisma.InputJsonValue,
        },
    })
}

// ==================== Query Functions ====================

export async function getStepEvents(
    stepId: string,
    options?: {
        since?: Date
        type?: StepEventType
        limit?: number
    }
): Promise<StepEvent[]> {
    return prisma.stepEvent.findMany({
        where: {
            stepId,
            ...(options?.since ? { createdAt: { gt: options.since } } : {}),
            ...(options?.type ? { type: options.type } : {}),
        },
        orderBy: { createdAt: "asc" },
        take: options?.limit,
    })
}

export async function getLatestStepEvent(
    stepId: string,
    type?: StepEventType
): Promise<StepEvent | null> {
    return prisma.stepEvent.findFirst({
        where: {
            stepId,
            ...(type ? { type } : {}),
        },
        orderBy: { createdAt: "desc" },
    })
}

// ==================== Aggregate Output ====================

export async function getFullStepOutput(stepId: string): Promise<string> {
    const events = await prisma.stepEvent.findMany({
        where: { stepId, type: "output" },
        orderBy: { createdAt: "asc" },
        select: { data: true },
    })

    let output = ""
    for (const event of events) {
        const data = event.data as unknown as OutputEventData
        if (data?.delta) {
            output += data.delta
        }
    }
    return output
}

// ==================== Cleanup ====================

export async function cleanupOldStepEvents(
    retentionDays: number = 7
): Promise<number> {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - retentionDays)

    // 只清理已完成的 step 的事件
    const result = await prisma.stepEvent.deleteMany({
        where: {
            createdAt: { lt: cutoff },
            step: {
                status: { in: ["SUCCEEDED", "FAILED", "SKIPPED"] },
            },
        },
    })

    return result.count
}
