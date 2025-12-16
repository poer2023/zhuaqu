import prisma from "@/lib/prisma"
import type { Prisma, Job, Step } from "@prisma/client"
import { AppError } from "@/server/errors"
import { calculateSimilarity, generateRewriteText, streamRewriteText, type RewriteParams } from "@/server/ai/rewrite"
import { markStepFailed, markStepSucceeded } from "@/server/orchestrator/orchestrator"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((v): v is string => typeof v === "string")
}

function asParams(value: unknown): RewriteParams {
  if (!isRecord(value)) return {}
  return value as RewriteParams
}

async function updateStepText(stepId: string, text: string): Promise<void> {
  await prisma.step.update({
    where: { id: stepId },
    data: { outputRef: { text } as Prisma.InputJsonValue },
  })
}

async function upsertRewriteVersionForStep(args: {
  stepId: string
  jobId: string
  contentItemId: string
  outputText: string
  params: RewriteParams
}): Promise<string> {
  const existing = await prisma.rewriteVersion.findFirst({
    where: { stepId: args.stepId },
    select: { id: true },
  })

  const similarityScore = calculateSimilarity(
    (await prisma.contentItem.findUnique({ where: { id: args.contentItemId }, select: { textOriginal: true } }))?.textOriginal || "",
    args.outputText
  )

  if (existing) {
    const updated = await prisma.rewriteVersion.update({
      where: { id: existing.id },
      data: {
        output: { text: args.outputText } as Prisma.InputJsonValue,
        outputFormat: args.params.outputFormat || "single",
        paramsSnapshot: args.params as Prisma.InputJsonValue,
        status: "GENERATED",
        charCount: args.outputText.length,
        similarityScore,
        warnings: similarityScore > 0.5 ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
      },
      select: { id: true },
    })

    await prisma.contentItem.update({
      where: { id: args.contentItemId },
      data: { rewriteStatus: "GENERATED" },
    })
    return updated.id
  }

  const latest = await prisma.rewriteVersion.findFirst({
    where: { contentItemId: args.contentItemId },
    orderBy: { version: "desc" },
    select: { version: true },
  })
  const nextVersion = (latest?.version || 0) + 1

  const created = await prisma.rewriteVersion.create({
    data: {
      contentItemId: args.contentItemId,
      version: nextVersion,
      output: { text: args.outputText } as Prisma.InputJsonValue,
      outputFormat: args.params.outputFormat || "single",
      paramsSnapshot: args.params as Prisma.InputJsonValue,
      status: "GENERATED",
      charCount: args.outputText.length,
      similarityScore,
      warnings: similarityScore > 0.5 ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
      jobId: args.jobId,
      stepId: args.stepId,
    },
    select: { id: true },
  })

  await prisma.contentItem.update({
    where: { id: args.contentItemId },
    data: { rewriteStatus: "GENERATED" },
  })

  return created.id
}

async function handleStreamRewrite(step: Step, job: Pick<Job, "id" | "workspaceId">): Promise<void> {
  const input = isRecord(step.inputRef) ? step.inputRef : {}
  const contentItemId = asString(input.contentItemId)
  const originalTextFromInput = asString(input.originalText)
  const params = asParams(input.params)

  const originalText = contentItemId
    ? (await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { textOriginal: true } }))?.textOriginal
    : originalTextFromInput

  if (!originalText) {
    throw new AppError("REWRITE_INPUT_MISSING", "originalText/contentItemId is required")
  }

  let fullText = ""
  let lastFlushAt = 0
  const flushIntervalMs = 250

  await updateStepText(step.id, "")

  await streamRewriteText({
    originalText,
    params,
    onDelta: async (delta) => {
      fullText += delta
      const now = Date.now()
      if (now - lastFlushAt < flushIntervalMs && fullText.length % 120 !== 0) return
      lastFlushAt = now
      await updateStepText(step.id, fullText)
    },
  })

  await updateStepText(step.id, fullText)

  if (contentItemId) {
    const rewriteVersionId = await upsertRewriteVersionForStep({
      stepId: step.id,
      jobId: job.id,
      contentItemId,
      outputText: fullText,
      params,
    })
    await prisma.step.update({
      where: { id: step.id },
      data: { outputRef: { text: fullText, charCount: fullText.length, rewriteVersionId } as Prisma.InputJsonValue },
    })
  } else {
    await prisma.step.update({
      where: { id: step.id },
      data: { outputRef: { text: fullText, charCount: fullText.length } as Prisma.InputJsonValue },
    })
  }

  await markStepSucceeded(step.id)
}

async function handleBatchRewrite(step: Step, job: Pick<Job, "id" | "workspaceId">): Promise<void> {
  const input = isRecord(step.inputRef) ? step.inputRef : {}
  const rewriteBatchId = asString(input.rewriteBatchId)
  const itemIds = asStringArray(input.itemIds)
  const params = asParams(input.params)

  if (!rewriteBatchId) {
    throw new AppError("REWRITE_BATCH_MISSING", "rewriteBatchId is required")
  }
  if (itemIds.length === 0) {
    throw new AppError("REWRITE_ITEMS_MISSING", "itemIds is required")
  }

  const batch = await prisma.rewriteBatch.findUnique({ where: { id: rewriteBatchId } })
  if (!batch) {
    throw new AppError("REWRITE_BATCH_NOT_FOUND", `RewriteBatch not found: ${rewriteBatchId}`)
  }

  await prisma.rewriteBatch.update({
    where: { id: rewriteBatchId },
    data: { status: "RUNNING", startedAt: batch.startedAt || new Date() },
  })

  await prisma.contentItem.updateMany({
    where: { id: { in: itemIds }, workspaceId: job.workspaceId },
    data: { rewriteStatus: "DRAFTING" },
  })

  const items = await prisma.contentItem.findMany({
    where: { id: { in: itemIds }, workspaceId: job.workspaceId },
    select: { id: true, textOriginal: true },
  })

  const byId = new Map(items.map((i) => [i.id, i]))
  const ordered = itemIds.map((id) => byId.get(id)).filter((v): v is { id: string; textOriginal: string } => Boolean(v))

  const failures: Array<{ contentItemId: string; error: string }> = []
  let succeeded = 0

  for (const item of ordered) {
    try {
      const rewrittenText = await generateRewriteText(item.textOriginal, params)
      const similarityScore = calculateSimilarity(item.textOriginal, rewrittenText)

      const existing = await prisma.rewriteVersion.findFirst({
        where: { batchId: rewriteBatchId, contentItemId: item.id, version: 1 },
        select: { id: true },
      })

      if (existing) {
        await prisma.rewriteVersion.update({
          where: { id: existing.id },
          data: {
            output: { text: rewrittenText } as Prisma.InputJsonValue,
            outputFormat: params.outputFormat || "single",
            paramsSnapshot: params as Prisma.InputJsonValue,
            status: "GENERATED",
            charCount: rewrittenText.length,
            similarityScore,
            warnings: similarityScore > 0.5 ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
            jobId: job.id,
            stepId: step.id,
          },
        })
      } else {
        await prisma.rewriteVersion.create({
          data: {
            contentItemId: item.id,
            batchId: rewriteBatchId,
            version: 1,
            output: { text: rewrittenText } as Prisma.InputJsonValue,
            outputFormat: params.outputFormat || "single",
            paramsSnapshot: params as Prisma.InputJsonValue,
            status: "GENERATED",
            charCount: rewrittenText.length,
            similarityScore,
            warnings: similarityScore > 0.5 ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
            jobId: job.id,
            stepId: step.id,
          },
        })
      }

      await prisma.contentItem.update({
        where: { id: item.id },
        data: { rewriteStatus: "GENERATED" },
      })

      succeeded++
      await prisma.rewriteBatch.update({
        where: { id: rewriteBatchId },
        data: { succeeded },
      })
    } catch (e) {
      failures.push({ contentItemId: item.id, error: e instanceof Error ? e.message : String(e) })
      await prisma.rewriteBatch.update({
        where: { id: rewriteBatchId },
        data: { failed: { increment: 1 } },
      })
    }
  }

  const failed = failures.length
  await prisma.rewriteBatch.update({
    where: { id: rewriteBatchId },
    data: {
      status: failed === 0 ? "DONE" : "PARTIAL_FAILED",
      failed,
      completedAt: new Date(),
    },
  })

  await prisma.step.update({
    where: { id: step.id },
    data: {
      outputRef: { total: ordered.length, succeeded, failed, failures } as Prisma.InputJsonValue,
    },
  })

  if (failed > 0) {
    await markStepFailed(step.id, new AppError("REWRITE_BATCH_PARTIAL_FAILED", `Rewrite batch partially failed (${failed}/${ordered.length})`))
    return
  }

  await markStepSucceeded(step.id, { total: ordered.length, succeeded, failed: 0 } as Prisma.InputJsonValue)
}

export async function handleRewriteStep(step: Step & { job: Pick<Job, "id" | "type" | "workspaceId" | "poolId"> }): Promise<void> {
  if (step.job.type !== "REWRITE") {
    throw new AppError("STEP_NOT_SUPPORTED", `Unsupported rewrite job type: ${step.job.type}`)
  }

  const input = isRecord(step.inputRef) ? step.inputRef : {}
  const mode = asString(input.mode)
  const rewriteBatchId = asString(input.rewriteBatchId)

  if (mode === "batch" || rewriteBatchId) {
    await handleBatchRewrite(step, { id: step.job.id, workspaceId: step.job.workspaceId })
    return
  }

  await handleStreamRewrite(step, { id: step.job.id, workspaceId: step.job.workspaceId })
}
