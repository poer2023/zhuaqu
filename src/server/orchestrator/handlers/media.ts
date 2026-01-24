import { AppError } from "@/server/errors"
import { markStepSucceeded, markStepSkipped } from "@/server/orchestrator/orchestrator"
import { appendStepLog, appendStepProgress } from "@/server/orchestrator/stepEvents"
import { downloadMedia } from "@/server/services/storage"
import { prisma } from "@/lib/prisma"

// ==================== Types ====================

type Job = { id: string; type: string; status: string; workspaceId: string; poolId: string | null }
type Step = { id: string; type: string; job: Job; inputRef: unknown; attemptCount: number; maxAttempts: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

// ==================== Media Handler ====================

export async function handleMediaStep(step: Step & { job: Job }): Promise<void> {
    const supportedJobTypes = ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"]
    if (!supportedJobTypes.includes(step.job.type)) {
        throw new AppError("STEP_NOT_SUPPORTED", `Invalid job type for MEDIA: ${step.job.type}`)
    }

    const input = isRecord(step.inputRef) ? step.inputRef : {}
    const mediaUrls = Array.isArray(input.mediaUrls) ? input.mediaUrls : []
    const contentItemId = typeof input.contentItemId === "string" ? input.contentItemId : null

    await appendStepLog(step.id, `Starting media processing for ${mediaUrls.length} items`)

    if (mediaUrls.length === 0) {
        await appendStepLog(step.id, "No media items to process, skipping")
        await markStepSkipped(step.id, { reason: "no_media_items" } as JsonValue)
        return
    }

    if (!contentItemId) {
        await appendStepLog(step.id, "No contentItemId provided, skipping media download", "warn")
        await markStepSkipped(step.id, { reason: "no_content_item_id" } as JsonValue)
        return
    }

    const results: Array<{ url: string; status: string; localUrl?: string; error?: string }> = []
    const updatedMedia: Array<{ type: string; url: string; originalUrl: string }> = []

    for (let i = 0; i < mediaUrls.length; i++) {
        const mediaItem = mediaUrls[i] as { type?: string; url?: string } | string
        const url = typeof mediaItem === "string" ? mediaItem : mediaItem?.url
        const type = typeof mediaItem === "string" ? "image" : (mediaItem?.type || "image")

        if (!url) {
            results.push({ url: "unknown", status: "skipped", error: "invalid_url" })
            continue
        }

        await appendStepProgress(step.id, i + 1, mediaUrls.length, `Downloading ${url}`)

        const downloadResult = await downloadMedia(url, step.job.workspaceId, contentItemId)

        if (downloadResult.success && downloadResult.publicUrl) {
            await appendStepLog(step.id, `Downloaded: ${url} -> ${downloadResult.publicUrl}`)
            results.push({ url, status: "downloaded", localUrl: downloadResult.publicUrl })
            updatedMedia.push({ type, url: downloadResult.publicUrl, originalUrl: url })
        } else {
            await appendStepLog(step.id, `Failed to download ${url}: ${downloadResult.error}`, "warn")
            results.push({ url, status: "failed", error: downloadResult.error })
            // Keep original URL if download fails
            updatedMedia.push({ type, url, originalUrl: url })
        }
    }

    // Update ContentItem with new media references
    if (updatedMedia.length > 0) {
        try {
            await prisma.contentItem.update({
                where: { id: contentItemId },
                data: { media: updatedMedia },
            })
            await appendStepLog(step.id, `Updated ContentItem ${contentItemId} with ${updatedMedia.length} media items`)
        } catch (error) {
            await appendStepLog(step.id, `Failed to update ContentItem: ${error}`, "error")
        }
    }

    const downloaded = results.filter((r) => r.status === "downloaded").length
    const failed = results.filter((r) => r.status === "failed").length

    await markStepSucceeded(step.id, {
        total: mediaUrls.length,
        downloaded,
        failed,
        results,
    } as JsonValue)
}
