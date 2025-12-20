import { AppError } from "@/server/errors"
import { markStepSkipped } from "@/server/orchestrator/orchestrator"
import { appendStepLog, appendStepProgress } from "@/server/orchestrator/stepEvents"

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

    await appendStepLog(step.id, `Starting media processing for ${mediaUrls.length} items`)

    if (mediaUrls.length === 0) {
        await appendStepLog(step.id, "No media items to process, skipping")
        await markStepSkipped(step.id, { reason: "no_media_items" } as JsonValue)
        return
    }

    // OPT-L2: This is a placeholder implementation - mark as skipped until properly implemented
    // TODO: Implement actual download and transcode logic:
    // 1. Download media files
    // 2. Store to R2/S3
    // 3. Optional: video transcode, image compression
    // 4. Update ContentItem media references

    const results: Array<{ url: string; status: string; reason?: string }> = []

    for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i] as string
        await appendStepProgress(step.id, i + 1, mediaUrls.length, `Processing ${url}`)

        // Mark as skipped since not implemented
        await appendStepLog(step.id, `Skipped media (not implemented): ${url}`, "warn")
        results.push({ url, status: "skipped", reason: "not_implemented" })
    }

    await markStepSkipped(step.id, {
        reason: "media_handler_not_implemented",
        total: mediaUrls.length,
        skipped: results.length,
        results,
    } as JsonValue)
}
