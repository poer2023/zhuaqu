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

// 创建安全的 JSON 对象，确保可以被 Prisma/PostgreSQL 正确处理
function sanitizeText(text: string): string {
  if (!text) return text
  
  let cleaned = ''
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    
    // 跳过控制字符（除了 tab, lf, cr）
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) {
      continue
    }
    
    // 处理 Unicode 代理对
    if (code >= 0xD800 && code <= 0xDBFF) {
      const next = text.charCodeAt(i + 1)
      if (next >= 0xDC00 && next <= 0xDFFF) {
        // 有效的代理对
        cleaned += text[i] + text[i + 1]
        i++
        continue
      }
      // 否则跳过孤立的高代理
      continue
    }
    
    // 跳过孤立的低代理
    if (code >= 0xDC00 && code <= 0xDFFF) {
      continue
    }
    
    cleaned += text[i]
  }
  // 移除可能导致 JSON 解析失败的转义序列（如不完整的 \x?? 或 \u???）
  cleaned = cleaned.replace(/\\x[0-9a-fA-F]?/g, '')
  cleaned = cleaned.replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '')

  return cleaned
}

function createSafeJsonObject(obj: Record<string, unknown>): Prisma.InputJsonValue {
  // 预清理字符串字段
  const normalized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      normalized[key] = sanitizeText(value)
    } else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      normalized[key] = value
    } else {
      normalized[key] = value
    }
  }

  // 通过 JSON 序列化/反序列化来"清洗"对象，确保可存储
  try {
    return JSON.parse(JSON.stringify(normalized)) as Prisma.InputJsonValue
  } catch (e) {
    // 若仍失败，返回字符串化后的安全文本
    const fallback: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(normalized)) {
      if (typeof value === 'string') fallback[key] = sanitizeText(value)
      else if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
        fallback[key] = value
      }
    }
    return fallback as Prisma.InputJsonValue
  }
}

async function updateStepText(stepId: string, text: string): Promise<void> {
  const safeText = sanitizeText(text)
  const safeOutput = createSafeJsonObject({ text: safeText })
  await prisma.step.update({
    where: { id: stepId },
    data: { outputRef: safeOutput },
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

  // 先 sanitize 文本，确保 charCount 与实际存储的文本长度一致
  const sanitizedOutputText = sanitizeText(args.outputText)
  
  const similarityScore = calculateSimilarity(
    (await prisma.contentItem.findUnique({ where: { id: args.contentItemId }, select: { textOriginal: true } }))?.textOriginal || "",
    sanitizedOutputText
  )

  const safeOutput = createSafeJsonObject({ text: sanitizedOutputText })
  const safeParams = createSafeJsonObject(args.params as Record<string, unknown>)
  const safeWarnings = similarityScore > 0.5 
    ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) 
    : ([] as Prisma.InputJsonValue)

  if (existing) {
    const updated = await prisma.rewriteVersion.update({
      where: { id: existing.id },
      data: {
        output: safeOutput,
        outputFormat: args.params.outputFormat || "single",
        paramsSnapshot: safeParams,
        status: "GENERATED",
        charCount: sanitizedOutputText.length,
        similarityScore,
        warnings: safeWarnings,
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
      output: safeOutput,
      outputFormat: args.params.outputFormat || "single",
      paramsSnapshot: safeParams,
      status: "GENERATED",
      charCount: sanitizedOutputText.length,
      similarityScore,
      warnings: safeWarnings,
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

  const safeFullText = sanitizeText(fullText)
  await updateStepText(step.id, safeFullText)

  if (contentItemId) {
    const rewriteVersionId = await upsertRewriteVersionForStep({
      stepId: step.id,
      jobId: job.id,
      contentItemId,
      outputText: safeFullText,
      params,
    })
    await prisma.step.update({
      where: { id: step.id },
      data: { outputRef: createSafeJsonObject({ text: safeFullText, charCount: safeFullText.length, rewriteVersionId }) },
    })
  } else {
    await prisma.step.update({
      where: { id: step.id },
      data: { outputRef: createSafeJsonObject({ text: safeFullText, charCount: safeFullText.length }) },
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

  const safeParams = createSafeJsonObject(params as Record<string, unknown>)

  for (const item of ordered) {
    try {
      const rawRewrittenText = await generateRewriteText(item.textOriginal, params)
      const rewrittenText = sanitizeText(rawRewrittenText)
      const similarityScore = calculateSimilarity(item.textOriginal, rewrittenText)
      const safeOutput = createSafeJsonObject({ text: rewrittenText })
      const safeWarnings = similarityScore > 0.5 
        ? (["与原文相似度较高，建议进一步改写"] as Prisma.InputJsonValue) 
        : ([] as Prisma.InputJsonValue)

      const existing = await prisma.rewriteVersion.findFirst({
        where: { batchId: rewriteBatchId, contentItemId: item.id, version: 1 },
        select: { id: true },
      })

      if (existing) {
        await prisma.rewriteVersion.update({
          where: { id: existing.id },
          data: {
            output: safeOutput,
            outputFormat: params.outputFormat || "single",
            paramsSnapshot: safeParams,
            status: "GENERATED",
            charCount: rewrittenText.length,
            similarityScore,
            warnings: safeWarnings,
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
            output: safeOutput,
            outputFormat: params.outputFormat || "single",
            paramsSnapshot: safeParams,
            status: "GENERATED",
            charCount: rewrittenText.length,
            similarityScore,
            warnings: safeWarnings,
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
      outputRef: createSafeJsonObject({ total: ordered.length, succeeded, failed, failures }),
    },
  })

  if (failed > 0) {
    await markStepFailed(step.id, new AppError("REWRITE_BATCH_PARTIAL_FAILED", `Rewrite batch partially failed (${failed}/${ordered.length})`))
    return
  }

  await markStepSucceeded(step.id, createSafeJsonObject({ total: ordered.length, succeeded, failed: 0 }))
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
