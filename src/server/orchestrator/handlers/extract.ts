import prisma from "@/lib/prisma"
import { AppError } from "@/server/errors"
import { markStepSucceeded, markStepSkipped } from "@/server/orchestrator/orchestrator"
import { appendStepLog, appendStepProgress } from "@/server/orchestrator/stepEvents"

// ==================== Types ====================

type Job = { id: string; type: string; status: string; workspaceId: string; poolId: string | null }
type Step = { id: string; type: string; job: Job; inputRef: unknown; attemptCount: number; maxAttempts: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

// ==================== Extract Handler ====================

export async function handleExtractStep(step: Step & { job: Job }): Promise<void> {
    const supportedJobTypes = ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"]
    if (!supportedJobTypes.includes(step.job.type)) {
        throw new AppError("STEP_NOT_SUPPORTED", `Invalid job type for EXTRACT: ${step.job.type}`)
    }

    const input = isRecord(step.inputRef) ? step.inputRef : {}
    const contentItemIds = Array.isArray(input.contentItemIds) ? input.contentItemIds : []

    await appendStepLog(step.id, `Starting extract for ${contentItemIds.length} content items`)

    if (contentItemIds.length === 0) {
        await appendStepLog(step.id, "No content items to process, skipping")
        await markStepSkipped(step.id, { reason: "no_content_items" } as JsonValue)
        return
    }

    const results: Array<{ contentItemId: string; summary?: string }> = []

    for (let i = 0; i < contentItemIds.length; i++) {
        const contentItemId = contentItemIds[i]
        await appendStepProgress(step.id, i + 1, contentItemIds.length, `Processing ${contentItemId}`)

        const item = await prisma.contentItem.findUnique({
            where: { id: contentItemId },
            select: { id: true, textOriginal: true },
        })

        if (!item) {
            await appendStepLog(step.id, `Content item ${contentItemId} not found, skipping`, "warn")
            continue
        }

        // 简单的文本清洗逻辑
        const rawText = item.textOriginal || ""
        const cleanedText = rawText
            .replace(/\s+/g, " ")           // 规范化空白
            .replace(/<[^>]*>/g, "")        // 移除 HTML 标签
            .trim()

        // 生成简单摘要（取前 200 字符）
        const summary = cleanedText.length > 200 ? cleanedText.slice(0, 200) + "..." : cleanedText

        results.push({ contentItemId, summary })
        await appendStepLog(step.id, `Extracted ${contentItemId}: ${summary.slice(0, 50)}...`)
    }

    await markStepSucceeded(step.id, {
        processed: results.length,
        results,
    } as JsonValue)
}
