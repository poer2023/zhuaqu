import prisma from "@/lib/prisma"
import { collectTweetUrlsFromSource, type SyncSource } from "@/server/sync/xSync"
import { ingestTweetUrl } from "@/server/ingest/ingestTweet"
import { appendStepLog, appendStepProgress } from "@/server/orchestrator/stepEvents"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

// ==================== Types ====================

type Progress = { discovered: number; submitted: number; ingested: number; failed: number; deduped: number }
type Failure = { url: string; code: string; error: string }
type RunState = "completed" | "failed" | "paused" | "cancelled"

interface SyncOptions {
  limit?: number
  excludeAuthors?: string[]
  includeReplies?: boolean
  mediaOnly?: boolean
}

function asProgress(value: unknown): Progress {
  const obj = typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}
  return {
    discovered: typeof obj.discovered === "number" ? obj.discovered : 0,
    submitted: typeof obj.submitted === "number" ? obj.submitted : 0,
    ingested: typeof obj.ingested === "number" ? obj.ingested : 0,
    failed: typeof obj.failed === "number" ? obj.failed : 0,
    deduped: typeof obj.deduped === "number" ? obj.deduped : 0,
  }
}

function parseOptions(raw: unknown): SyncOptions {
  const obj = typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {}
  return {
    limit: typeof obj.limit === "number" ? Math.max(1, Math.min(2000, obj.limit)) : 100,
    excludeAuthors: Array.isArray(obj.excludeAuthors) ? obj.excludeAuthors.filter((x) => typeof x === "string") : [],
    includeReplies: obj.includeReplies === true,
    mediaOnly: obj.mediaOnly === true,
  }
}

// ==================== Throttle Helper ====================

async function throttledSleep(attemptIndex: number): Promise<void> {
  // 基础节流：每 10 个请求暂停一下
  if (attemptIndex > 0 && attemptIndex % 10 === 0) {
    const sleepMs = 500 + Math.random() * 500 // 500-1000ms
    await new Promise((r) => setTimeout(r, sleepMs))
  }
}

// ==================== Main Runner ====================

export async function runSyncJob(args: { syncJobId: string; orchestrationJobId: string; stepId: string }): Promise<{
  state: RunState
  total: number
  ingested: number
  deduped: number
  failed: number
  failures: Failure[]
}> {
  const job = await prisma.syncJob.findUnique({ where: { id: args.syncJobId } })
  if (!job) {
    return { state: "failed", total: 0, ingested: 0, deduped: 0, failed: 0, failures: [{ url: "", code: "SYNC_JOB_NOT_FOUND", error: `SyncJob not found: ${args.syncJobId}` }] }
  }

  if (job.status === "CANCELLED") {
    return { state: "cancelled", total: 0, ingested: 0, deduped: 0, failed: 0, failures: [] }
  }

  if (job.status === "PAUSED") {
    return { state: "paused", total: 0, ingested: 0, deduped: 0, failed: 0, failures: [] }
  }

  await appendStepLog(args.stepId, `Starting sync job ${args.syncJobId}`)

  await prisma.syncJob.update({
    where: { id: args.syncJobId },
    data: {
      status: "RUNNING",
      startedAt: job.startedAt || new Date(),
      error: null,
    },
  })

  const source = job.source as unknown as SyncSource
  const options = parseOptions(job.options)
  const previousProgress = asProgress(job.progress)

  await appendStepLog(args.stepId, `Options: limit=${options.limit}, excludeAuthors=${options.excludeAuthors?.join(",") || "none"}, includeReplies=${options.includeReplies}, mediaOnly=${options.mediaOnly}`)

  const { urls } = await collectTweetUrlsFromSource({
    source,
    limit: options.limit!,
  })

  await appendStepLog(args.stepId, `Discovered ${urls.length} URLs`)

  const nextProgress: Progress = {
    discovered: previousProgress.discovered + urls.length,
    submitted: previousProgress.submitted,
    ingested: previousProgress.ingested,
    failed: previousProgress.failed,
    deduped: previousProgress.deduped,
  }

  await prisma.syncJob.update({
    where: { id: args.syncJobId },
    data: {
      totalItems: nextProgress.discovered,
      progress: nextProgress as JsonValue,
    },
  })

  let ingested = 0
  let deduped = 0
  let failed = 0
  const failures: Failure[] = []
  const maxFailurePreview = 50

  const updateEvery = 5
  const statusCheckEvery = 5
  let stop: "PAUSED" | "CANCELLED" | null = null

  for (let i = 0; i < urls.length; i++) {
    const url = urls[i]

    // 节流
    await throttledSleep(i)

    // 检查作业状态
    if (i % statusCheckEvery === 0) {
      const latest = await prisma.syncJob.findUnique({ where: { id: args.syncJobId }, select: { status: true } })
      if (latest?.status === "PAUSED" || latest?.status === "CANCELLED") {
        stop = latest.status
        await appendStepLog(args.stepId, `Job ${stop.toLowerCase()}, stopping at ${i}/${urls.length}`)
        break
      }
    }

    // URL 过滤：excludeAuthors
    if (options.excludeAuthors && options.excludeAuthors.length > 0) {
      const lowerUrl = url.toLowerCase()
      const excluded = options.excludeAuthors.some((author) => lowerUrl.includes(`/${author.toLowerCase()}/`))
      if (excluded) {
        deduped++
        nextProgress.deduped++
        continue
      }
    }

    const res = await ingestTweetUrl({
      workspaceId: job.workspaceId,
      poolId: job.poolId,
      jobId: args.orchestrationJobId,
      url,
      mediaMode: "link",
    })

    nextProgress.submitted++

    if (res.outcome === "created") {
      // 如果 mediaOnly 且没有媒体，跳过
      if (options.mediaOnly && res.contentItemId) {
        const item = await prisma.contentItem.findUnique({
          where: { id: res.contentItemId },
          select: { media: true },
        })
        const mediaRefs = item?.media as unknown[]
        if (!mediaRefs || mediaRefs.length === 0) {
          deduped++
          nextProgress.deduped++
          continue
        }
      }

      ingested++
      nextProgress.ingested++
    } else if (res.outcome === "deduped") {
      deduped++
      nextProgress.deduped++
    } else {
      failed++
      nextProgress.failed++
      if (failures.length < maxFailurePreview) {
        failures.push({ url, code: res.code, error: res.error })
      }
    }

    // 进度上报
    await appendStepProgress(args.stepId, i + 1, urls.length, `Synced ${ingested} / ${deduped} deduped / ${failed} failed`)

    if ((i + 1) % updateEvery === 0) {
      await prisma.syncJob.update({
        where: { id: args.syncJobId },
        data: {
          progress: nextProgress as JsonValue,
          successCount: previousProgress.ingested + ingested,
          dedupedCount: previousProgress.deduped + deduped,
          failCount: previousProgress.failed + failed,
        },
      })
    }
  }

  // 最终更新
  await prisma.syncJob.update({
    where: { id: args.syncJobId },
    data: {
      progress: nextProgress as JsonValue,
      totalItems: nextProgress.discovered,
      successCount: previousProgress.ingested + ingested,
      dedupedCount: previousProgress.deduped + deduped,
      failCount: previousProgress.failed + failed,
    },
  })

  if (stop === "PAUSED") {
    await appendStepLog(args.stepId, `Paused`, "warn")
    return { state: "paused", total: urls.length, ingested, deduped, failed, failures }
  }
  if (stop === "CANCELLED") {
    return { state: "cancelled", total: urls.length, ingested, deduped, failed, failures }
  }

  const completedAt = new Date()
  if (failed > 0) {
    await prisma.syncJob.update({
      where: { id: args.syncJobId },
      data: {
        status: "FAILED",
        completedAt,
        error: `Some items failed (${failed}/${urls.length})`,
      },
    })
    await appendStepLog(args.stepId, `Completed with ${failed} failures`, "error")
    return { state: "failed", total: urls.length, ingested, deduped, failed, failures }
  }

  await prisma.syncJob.update({
    where: { id: args.syncJobId },
    data: {
      status: "COMPLETED",
      completedAt,
      error: null,
    },
  })

  await appendStepLog(args.stepId, `Completed: ${ingested} ingested, ${deduped} deduped`)
  return { state: "completed", total: urls.length, ingested, deduped, failed: 0, failures: [] }
}
