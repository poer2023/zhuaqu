import prisma from "@/lib/prisma"
import { AppError, getErrorMessage } from "@/server/errors"
import { runIngestJob } from "@/server/jobs/ingest"
import { markStepFailed, markStepSkipped, markStepSucceeded } from "@/server/orchestrator/orchestrator"
import { runSyncJob } from "@/server/sync/runSyncJob"
import type { Prisma } from "@prisma/client"
import type { Job, Step } from "@prisma/client"

export async function handleCaptureStep(step: Step & { job: Pick<Job, "id" | "type" | "workspaceId" | "poolId"> }): Promise<void> {
  if (step.job.type === "INGEST_URL") {
    const ingestJob = await prisma.ingestJob.findUnique({ where: { jobId: step.job.id }, select: { id: true } })
    if (!ingestJob) {
      throw new AppError("INGEST_JOB_NOT_FOUND", `IngestJob not found for orchestration job ${step.job.id}`)
    }
    await runIngestJob(ingestJob.id)
    return
  }

  if (step.job.type === "SYNC_LIKES" || step.job.type === "SYNC_BOOKMARKS" || step.job.type === "SYNC_TIMELINE") {
    const syncJobId = (() => {
      const input = step.inputRef as unknown
      if (typeof input !== "object" || input === null) return null
      const v = (input as Record<string, unknown>).syncJobId
      return typeof v === "string" ? v : null
    })()

    const syncJob = syncJobId
      ? await prisma.syncJob.findUnique({ where: { id: syncJobId }, select: { id: true } })
      : await prisma.syncJob.findUnique({ where: { jobId: step.job.id }, select: { id: true } })
    if (!syncJob) {
      throw new AppError("SYNC_JOB_NOT_FOUND", `SyncJob not found for orchestration job ${step.job.id}`)
    }

    let result: Awaited<ReturnType<typeof runSyncJob>>
    try {
      result = await runSyncJob({ syncJobId: syncJob.id, orchestrationJobId: step.job.id, stepId: step.id })
    } catch (e) {
      const message = getErrorMessage(e)
      const isTerminal = step.attemptCount >= step.maxAttempts
      await prisma.syncJob.update({
        where: { id: syncJob.id },
        data: {
          status: isTerminal ? "FAILED" : "PENDING",
          error: message,
          completedAt: isTerminal ? new Date() : null,
        },
      })
      await markStepFailed(step.id, e)
      return
    }

    const outputRef = {
      total: result.total,
      ingested: result.ingested,
      deduped: result.deduped,
      failed: result.failed,
      failures: result.failures,
    } as Prisma.InputJsonValue

    if (result.state === "paused") {
      const now = new Date()
      await prisma.job.updateMany({ where: { id: step.job.id, status: { not: "CANCELED" } }, data: { status: "PAUSED" } })
      await prisma.step.update({
        where: { id: step.id },
        data: {
          status: "QUEUED",
          availableAt: now,
          startedAt: null,
          completedAt: null,
          outputRef,
          error: {},
        },
      })
      return
    }

    if (result.state === "cancelled") {
      await markStepSkipped(
        step.id,
        {
          total: result.total,
          ingested: result.ingested,
          deduped: result.deduped,
          failed: result.failed,
          failures: result.failures,
          reason: "cancelled",
        } as Prisma.InputJsonValue
      )
      return
    }

    if (result.failed > 0) {
      await prisma.step.update({ where: { id: step.id }, data: { outputRef } })
      await markStepFailed(step.id, new AppError("SYNC_PARTIAL_FAILED", `Sync partially failed (${result.failed}/${result.total})`))
      return
    }

    await markStepSucceeded(step.id, outputRef)
    return
  }

  throw new AppError("STEP_NOT_SUPPORTED", `Unsupported capture job type: ${step.job.type}`)
}
