import prisma from "@/lib/prisma"
import { AppError, getErrorCode, getErrorMessage, isRetryableError } from "@/server/errors"
import { markStepFailed, markStepFailedTerminal, markStepSkipped, markStepSucceeded } from "@/server/orchestrator/orchestrator"
import { appendStepLog } from "@/server/orchestrator/stepEvents"
import { postThread, postTweet } from "@/server/publish/xPublisher"

// ==================== Types ====================

type Job = { id: string; type: string; status: string; workspaceId: string; poolId: string | null }
type Step = { id: string; type: string; job: Job; inputRef: unknown; attemptCount: number; maxAttempts: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

// ==================== Helper Functions ====================

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asTweetText(output: unknown): string {
  if (isRecord(output) && typeof output.text === "string") return output.text
  return ""
}

function asThreadTweets(output: unknown): string[] {
  if (!Array.isArray(output)) return []
  const tweets: string[] = []
  for (const entry of output) {
    if (!isRecord(entry)) continue
    const text = asString(entry.text)
    if (text) tweets.push(text)
  }
  return tweets
}

// ==================== Idempotency Check ====================

async function checkExistingPublish(
  contentItemId: string
): Promise<{ tweetId: string; tweetUrl: string } | null> {
  const existingResult = await prisma.publishResult.findFirst({
    where: { contentItemId },
    orderBy: { publishedAt: "desc" },
    select: { tweetId: true, tweetUrl: true },
  })

  return existingResult ?? null
}

// ==================== Main Handler ====================

export async function handlePublishStep(step: Step & { job: Pick<Job, "id" | "type" | "workspaceId" | "poolId"> }): Promise<void> {
  if (step.job.type !== "PUBLISH") {
    throw new AppError("STEP_NOT_SUPPORTED", `Unsupported publish job type: ${step.job.type}`)
  }

  const input = isRecord(step.inputRef) ? step.inputRef : {}
  const publishJobId = asString(input.publishJobId)
  if (!publishJobId) {
    throw new AppError("PUBLISH_JOB_ID_MISSING", "publishJobId is required in step.inputRef")
  }

  await appendStepLog(step.id, `Starting publish step for job ${publishJobId}`)

  const publishJob = await prisma.publishJob.findUnique({
    where: { id: publishJobId },
    include: {
      rewriteVersion: { include: { contentItem: true } },
      publishResults: true,
    },
  })
  if (!publishJob) {
    throw new AppError("PUBLISH_JOB_NOT_FOUND", `PublishJob not found: ${publishJobId}`)
  }

  // 检查是否已发布
  if (publishJob.status === "PUBLISHED") {
    await appendStepLog(step.id, "Job already published, skipping")
    await markStepSkipped(step.id, { reason: "already_published" } as JsonValue)
    return
  }

  // 检查幂等：是否已有发布结果
  const existingPublish = await checkExistingPublish(publishJob.rewriteVersion.contentItemId)
  if (existingPublish) {
    await appendStepLog(step.id, `Found existing publish result: ${existingPublish.tweetUrl}`)
    await markStepSkipped(step.id, {
      reason: "already_published_idempotent",
      existingTweetId: existingPublish.tweetId,
      existingTweetUrl: existingPublish.tweetUrl,
    } as JsonValue)
    return
  }

  const output = publishJob.rewriteVersion.output as unknown
  const mode = publishJob.mode === "thread" ? "thread" : "single"

  const tweets = mode === "thread" ? asThreadTweets(output) : []
  const text = mode === "single" ? asTweetText(output) : ""

  const toPublish = mode === "thread" ? tweets : [text].filter(Boolean)
  if (toPublish.length === 0) {
    await prisma.publishJob.update({
      where: { id: publishJobId },
      data: {
        status: "FAILED",
        lastError: "No publish content found",
        completedAt: new Date(),
      },
    })
    await markStepFailedTerminal(step.id, new AppError("PUBLISH_CONTENT_EMPTY", "No publish content found"))
    return
  }

  await appendStepLog(step.id, `Publishing ${toPublish.length} tweet(s) in ${mode} mode`)

  await prisma.publishJob.update({
    where: { id: publishJobId },
    data: {
      startedAt: publishJob.startedAt || new Date(),
      retryCount: step.attemptCount,
      lastError: null,
    },
  })

  try {
    if (mode === "thread" && toPublish.length > 1) {
      const result = await postThread(toPublish)

      // 检查是否有部分或全部未捕获 ID
      const missingIds = result.results.filter((r) => !r.tweetId || !r.tweetUrl)

      if (!result.success || missingIds.length > 0) {
        const hasAnySuccess = result.results.some((r) => r.tweetId && r.tweetUrl)

        if (hasAnySuccess || result.success) {
          await handleUnknownPublish(step.id, publishJobId, publishJob.rewriteVersion.contentItemId,
            "Thread may have been posted but ids/urls not fully captured - manual verification required",
            result as JsonValue
          )
          return
        } else {
          throw new AppError("PUBLISH_THREAD_FAILED", "Failed to publish thread")
        }
      }

      const tweetIds = result.results.map((r) => r.tweetId).filter((v): v is string => typeof v === "string")
      const tweetUrls = result.results.map((r) => r.tweetUrl).filter((v): v is string => typeof v === "string")

      // 使用非事务方式逐步执行，避免类型问题
      await prisma.publishResult.deleteMany({ where: { publishJobId } })

      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i]
        if (!r.tweetId || !r.tweetUrl) continue
        await prisma.publishResult.create({
          data: {
            publishJobId,
            contentItemId: publishJob.rewriteVersion.contentItemId,
            tweetId: r.tweetId,
            tweetUrl: r.tweetUrl,
            position: i,
            responseJson: r as JsonValue,
          },
        })
      }

      const resultMap: Record<string, string> = {}
      for (let i = 0; i < result.results.length; i++) {
        const url = result.results[i]?.tweetUrl
        if (url) resultMap[String(i)] = url
      }

      await prisma.publishJob.update({
        where: { id: publishJobId },
        data: {
          status: "PUBLISHED",
          completedAt: new Date(),
          resultMap: resultMap as JsonValue,
        },
      })

      await prisma.contentItem.update({
        where: { id: publishJob.rewriteVersion.contentItemId },
        data: { publishStatus: "PUBLISHED" },
      })

      await appendStepLog(step.id, `Thread published successfully: ${tweetUrls.join(", ")}`)
      await markStepSucceeded(step.id, { tweetIds, tweetUrls } as JsonValue)
      return
    }

    // Single tweet
    const result = await postTweet(toPublish[0])

    if (!result.success) {
      throw new AppError("PUBLISH_TWEET_FAILED", result.error || "Failed to publish tweet")
    }

    if (!result.tweetId || !result.tweetUrl) {
      await handleUnknownPublish(step.id, publishJobId, publishJob.rewriteVersion.contentItemId,
        "Tweet may have been posted but id/url not captured - manual verification required",
        result as JsonValue
      )
      return
    }

    await prisma.publishResult.deleteMany({ where: { publishJobId } })

    await prisma.publishResult.create({
      data: {
        publishJobId,
        contentItemId: publishJob.rewriteVersion.contentItemId,
        tweetId: result.tweetId,
        tweetUrl: result.tweetUrl,
        position: 0,
        responseJson: result as JsonValue,
      },
    })

    await prisma.publishJob.update({
      where: { id: publishJobId },
      data: {
        status: "PUBLISHED",
        completedAt: new Date(),
        resultMap: { "0": result.tweetUrl } as JsonValue,
      },
    })

    await prisma.contentItem.update({
      where: { id: publishJob.rewriteVersion.contentItemId },
      data: { publishStatus: "PUBLISHED" },
    })

    await appendStepLog(step.id, `Tweet published successfully: ${result.tweetUrl}`)
    await markStepSucceeded(step.id, { tweetId: result.tweetId, tweetUrl: result.tweetUrl } as JsonValue)
  } catch (e) {
    const code = getErrorCode(e)
    const retryable = isRetryableError(e)
    const isUnknown = code === "PUBLISH_TWEET_UNKNOWN" || code === "PUBLISH_THREAD_UNKNOWN"
    const isTerminal = isUnknown || !retryable || step.attemptCount >= step.maxAttempts
    const errorMessage = getErrorMessage(e)

    await appendStepLog(step.id, `Publish failed: ${errorMessage} (retryable: ${retryable}, terminal: ${isTerminal})`, "error")

    if (isUnknown) {
      await handleUnknownPublish(step.id, publishJobId, publishJob.rewriteVersion.contentItemId, errorMessage, null)
      return
    }

    await prisma.publishJob.update({
      where: { id: publishJobId },
      data: {
        status: isTerminal ? "FAILED" : "QUEUED",
        lastError: errorMessage,
        completedAt: isTerminal ? new Date() : null,
      },
    })

    await prisma.contentItem.update({
      where: { id: publishJob.rewriteVersion.contentItemId },
      data: { publishStatus: isTerminal ? "FAILED" : "QUEUED" },
    })

    if (isTerminal) {
      await markStepFailedTerminal(step.id, e)
      return
    }

    await markStepFailed(step.id, e)
  }
}

// ==================== Handle Unknown Publish Status ====================

async function handleUnknownPublish(
  stepId: string,
  publishJobId: string,
  contentItemId: string,
  errorMessage: string,
  partialResult: JsonValue
): Promise<void> {
  await appendStepLog(stepId, `Marking as UNKNOWN: ${errorMessage}`, "warn")

  await prisma.publishJob.update({
    where: { id: publishJobId },
    data: {
      status: "UNKNOWN",
      lastError: errorMessage,
      completedAt: new Date(),
      resultMap: partialResult ?? {},
    },
  })

  await prisma.contentItem.update({
    where: { id: contentItemId },
    data: { publishStatus: "UNKNOWN" },
  })

  await markStepFailedTerminal(
    stepId,
    new AppError("PUBLISH_TWEET_UNKNOWN", errorMessage)
  )
}
