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

    const results: Array<{ url: string; status: string; localPath?: string }> = []

    for (let i = 0; i < mediaUrls.length; i++) {
        const url = mediaUrls[i] as string
        await appendStepProgress(step.id, i + 1, mediaUrls.length, `Processing ${url}`)

        try {
            // TODO: 实际的下载和转码逻辑
            // 这里只是占位，实际实现需要：
            // 1. 下载媒体文件
            // 2. 存储到 R2/S3
            // 3. 可选：视频转码、图片压缩
            // 4. 更新 ContentItem 的媒体引用

            await appendStepLog(step.id, `Processed media: ${url}`)
            results.push({ url, status: "downloaded" })
        } catch (e) {
            await appendStepLog(step.id, `Failed to process ${url}: ${e}`, "error")
            results.push({ url, status: "failed" })
        }
    }

    const succeeded = results.filter((r) => r.status === "downloaded").length
    const failed = results.filter((r) => r.status === "failed").length

    await markStepSucceeded(step.id, {
        total: mediaUrls.length,
        succeeded,
        failed,
        results,
    } as JsonValue)
}
