import prisma from "@/lib/prisma"
import { AppError } from "@/server/errors"
import { markStepSucceeded, markStepSkipped } from "@/server/orchestrator/orchestrator"
import { appendStepLog } from "@/server/orchestrator/stepEvents"

// ==================== Types ====================

type Job = { id: string; type: string; status: string; workspaceId: string; poolId: string | null }
type Step = { id: string; type: string; job: Job; inputRef: unknown; attemptCount: number; maxAttempts: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

// ==================== Schedule Handler ====================

export async function handleScheduleStep(step: Step & { job: Job }): Promise<void> {
    const supportedJobTypes = ["PUBLISH", "PIPELINE"]
    if (!supportedJobTypes.includes(step.job.type)) {
        throw new AppError("STEP_NOT_SUPPORTED", `Invalid job type for SCHEDULE: ${step.job.type}`)
    }

    const input = isRecord(step.inputRef) ? step.inputRef : {}
    const publishJobId = typeof input.publishJobId === "string" ? input.publishJobId : null
    const scheduledAt = typeof input.scheduledAt === "string" ? new Date(input.scheduledAt) : null

    await appendStepLog(step.id, `Processing schedule for publish job ${publishJobId}`)

    if (!publishJobId) {
        await appendStepLog(step.id, "No publish job ID provided, skipping")
        await markStepSkipped(step.id, { reason: "no_publish_job_id" } as JsonValue)
        return
    }

    const publishJob = await prisma.publishJob.findUnique({
        where: { id: publishJobId },
        select: { id: true, status: true, scheduledAt: true },
    })

    if (!publishJob) {
        throw new AppError("PUBLISH_JOB_NOT_FOUND", `Publish job ${publishJobId} not found`)
    }

    // 如果指定了调度时间，更新 publish job 和对应的 step
    if (scheduledAt) {
        await prisma.publishJob.update({
            where: { id: publishJobId },
            data: { scheduledAt },
        })

        // 更新后续 PUBLISH step 的 availableAt
        const publishStep = await prisma.step.findFirst({
            where: {
                jobId: step.job.id,
                type: "PUBLISH",
                status: "QUEUED",
            },
            select: { id: true },
        })

        if (publishStep) {
            await prisma.step.update({
                where: { id: publishStep.id },
                data: { availableAt: scheduledAt },
            })
            await appendStepLog(step.id, `Publish step ${publishStep.id} scheduled for ${scheduledAt.toISOString()}`)
        }

        await markStepSucceeded(step.id, {
            publishJobId,
            scheduledAt: scheduledAt.toISOString(),
            action: "scheduled",
        } as JsonValue)
        return
    }

    // 无调度时间，立即可用
    await appendStepLog(step.id, "No schedule time specified, publish will execute immediately")
    await markStepSucceeded(step.id, {
        publishJobId,
        action: "immediate",
    } as JsonValue)
}
