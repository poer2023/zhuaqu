import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { ingestTweetUrl } from "@/server/ingest/ingestTweet"
import { jobLogger } from "@/lib/logger"
import { withRetry, isRetryableError } from "@/lib/retry"

function getStringArray(json: unknown): string[] {
  if (!Array.isArray(json)) return []
  return json.filter((v): v is string => typeof v === "string")
}

function getMediaMode(options: unknown): "link" | "download" {
  if (!options || typeof options !== "object") return "link"
  const opts = options as Record<string, unknown>
  const mode = opts.mediaMode ?? opts.media_mode
  return mode === "download" ? "download" : "link"
}

function getThreadMode(options: unknown): "single" | "thread" {
  if (!options || typeof options !== "object") return "single"
  const opts = options as Record<string, unknown>
  return opts.threadMode === "thread" ? "thread" : "single"
}

function getQuoteMode(options: unknown): "ignore" | "follow" {
  if (!options || typeof options !== "object") return "ignore"
  const opts = options as Record<string, unknown>
  return opts.quoteMode === "follow" ? "follow" : "ignore"
}

export async function runIngestJob(jobId: string): Promise<void> {
  const job = await prisma.ingestJob.findUnique({ where: { id: jobId } })
  if (!job) return

  const log = jobLogger(jobId, "INGEST")
  log.info({ workspaceId: job.workspaceId, poolId: job.poolId }, "Starting ingest job")

  const urls = getStringArray(job.urls)
  const mediaMode = getMediaMode(job.options)
  const tagIds = getStringArray(job.tags)

  const failures: Array<{ url: string; code: string; error: string }> = []
  let succeeded = 0
  let failed = 0
  let deduped = 0

  await prisma.ingestJob.update({
    where: { id: jobId },
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      total: urls.length,
      succeeded: 0,
      failed: 0,
      deduped: 0,
      failures: [],
    },
  })

  if (job.jobId) {
    await prisma.job.updateMany({
      where: { id: job.jobId, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "RUNNING" },
    })
    await prisma.step.updateMany({
      where: { jobId: job.jobId, type: "CAPTURE", status: { in: ["QUEUED", "FAILED"] } },
      data: {
        status: "RUNNING",
        startedAt: new Date(),
        availableAt: new Date(),
        attemptCount: { increment: 1 },
        error: {},
      },
    })
  }

  const threadMode = getThreadMode(job.options)
  const quoteMode = getQuoteMode(job.options)

  // Use a queue for URL processing to support dynamic expansion
  const urlQueue = [...urls]
  const processedUrls = new Set<string>()

  // OPT-M2: Cap at 500 and track if truncated
  const MAX_URLS = 500
  const truncated = urlQueue.length > MAX_URLS

  for (let i = 0; i < urlQueue.length && i < MAX_URLS; i++) {
    const rawUrl = urlQueue[i]

    // Skip if already processed
    if (processedUrls.has(rawUrl)) {
      continue
    }
    processedUrls.add(rawUrl)

    log.debug({ url: rawUrl, index: i }, "Processing URL")

    // Use retry wrapper for network resilience
    const res = await withRetry(
      () => ingestTweetUrl({
        workspaceId: job.workspaceId,
        poolId: job.poolId,
        jobId: job.jobId ?? null,
        url: rawUrl,
        notes: job.notes ?? null,
        tagIds,
        mediaMode,
      }),
      {
        maxAttempts: 3,
        baseDelayMs: 1000,
        onRetry: (attempt, error, delayMs) => {
          log.warn({ url: rawUrl, attempt, error: String(error), delayMs }, "Retrying URL ingest")
        }
      }
    ).catch((error) => {
      // Return failure result for non-retryable errors or exhausted retries
      log.error({ url: rawUrl, error: String(error) }, "URL ingest failed after retries")
      return {
        outcome: "failed" as const,
        code: isRetryableError(error) ? "RETRY_EXHAUSTED" : "NON_RETRYABLE",
        error: String(error),
      }
    })

    if (res.outcome === "created") {
      succeeded++
      log.debug({ url: rawUrl, contentItemId: res.contentItemId }, "URL ingested successfully")
      await prisma.ingestJob.update({ where: { id: jobId }, data: { succeeded, total: urlQueue.length } })

      // Thread expansion: if enabled, fetch the content item and check for replies in thread
      if (threadMode === "thread" && res.contentItemId) {
        const item = await prisma.contentItem.findUnique({
          where: { id: res.contentItemId },
          select: { rawJson: true }
        })
        if (item?.rawJson) {
          const raw = item.rawJson as Record<string, unknown>
          // Check if this tweet is part of a thread (has in_reply_to from same author)
          const inReplyTo = (raw as { inReplyToStatusId?: string }).inReplyToStatusId
          if (inReplyTo && !processedUrls.has(`https://x.com/i/status/${inReplyTo}`)) {
            urlQueue.push(`https://x.com/i/status/${inReplyTo}`)
          }
        }
      }

      // Quote expansion: if enabled, extract quoted tweet URL
      if (quoteMode === "follow" && res.contentItemId) {
        const item = await prisma.contentItem.findUnique({
          where: { id: res.contentItemId },
          select: { rawJson: true }
        })
        if (item?.rawJson) {
          const raw = item.rawJson as Record<string, unknown>
          const quotedUrl = (raw as { quotedTweetUrl?: string }).quotedTweetUrl
          if (quotedUrl && !processedUrls.has(quotedUrl)) {
            urlQueue.push(quotedUrl)
          }
        }
      }
      continue
    }

    if (res.outcome === "deduped") {
      deduped++
      await prisma.ingestJob.update({ where: { id: jobId }, data: { deduped } })
      continue
    }

    failed++
    failures.push({ url: rawUrl, code: res.code, error: res.error })
    await prisma.ingestJob.update({ where: { id: jobId }, data: { failed, failures } })
  }

  const status = failed === 0 ? "DONE" : "PARTIAL_FAILED"
  await prisma.ingestJob.update({
    where: { id: jobId },
    data: {
      status,
      succeeded,
      failed,
      deduped,
      failures,
      completedAt: new Date(),
    },
  })

  if (job.jobId) {
    const done = status === "DONE"
    await prisma.job.updateMany({
      where: { id: job.jobId },
      data: { status: done ? "DONE" : "FAILED" },
    })
    await prisma.step.updateMany({
      where: { jobId: job.jobId, type: "CAPTURE" },
      data: {
        status: done ? "SUCCEEDED" : "FAILED",
        completedAt: new Date(),
        // OPT-M2: Include truncated flag in output for visibility
        outputRef: { total: Math.min(urlQueue.length, MAX_URLS), succeeded, failed, deduped, truncated } as Prisma.InputJsonValue,
        error: done
          ? {}
          : ({
            code: "INGEST_PARTIAL_FAILED",
            message: `Ingest partially failed (${failed}/${urls.length})`,
            at: new Date().toISOString(),
          } as Prisma.InputJsonValue),
      },
    })
  }

  await prisma.auditLog.create({
    data: {
      workspaceId: job.workspaceId,
      action: status === "DONE" ? "INGEST_COMPLETED" : "INGEST_FAILED",
      // OPT-M2: Include truncated in audit log
      details: { jobId, total: Math.min(urlQueue.length, MAX_URLS), succeeded, failed, deduped, truncated },
      actor: "system",
    },
  })

  // OPT-M2: Log truncated status for debugging
  const processedTotal = Math.min(urlQueue.length, MAX_URLS)
  log.info({ status, succeeded, failed, deduped, total: processedTotal, truncated }, "Ingest job completed")
}
