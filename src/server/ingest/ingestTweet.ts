import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { getErrorMessage } from "@/server/errors"
import { parseTweetUrl } from "@/server/x/parseTweetUrl"
import { extractTweetFromXGraphql, fetchXTweetGraphql } from "@/server/x/xGraphql"
import { extractTweetFromYtDlp, ytDlpDownloadMp4, ytDlpJson } from "@/server/x/ytDlp"
import { downloadToFile } from "@/server/media/download"
import { getContentItemVideoPathAbs, toProjectRelativePath } from "@/server/media/localStore"

type IngestOutcome =
  | { outcome: "created"; contentItemId: string }
  | { outcome: "deduped"; contentItemId: string }
  | { outcome: "failed"; code: string; error: string }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function ensureExistingItemVideoDownloaded(args: {
  contentItemId: string
  canonicalUrl: string
}): Promise<void> {
  const item = await prisma.contentItem.findUnique({
    where: { id: args.contentItemId },
    select: { id: true, media: true },
  })
  if (!item) return

  const media = Array.isArray(item.media) ? item.media : []
  const videoIndex = media.findIndex((m) => isObject(m) && m.type === "video")
  if (videoIndex === -1) return

  const entry = media[videoIndex]
  if (!isObject(entry)) return

  const download = isObject(entry.download) ? entry.download : {}
  const status = typeof download.status === "string" ? download.status : null
  const existingLocalPath = typeof download.localPath === "string" ? download.localPath : null

  if (status === "ready" && existingLocalPath) return

  entry.download = {
    ...download,
    status: "queued",
    error: null,
  }

  await prisma.contentItem.update({
    where: { id: args.contentItemId },
    data: {
      media: media as Prisma.InputJsonValue,
      captureStatus: "FETCHING",
    },
  })

  const directUrl = typeof entry.directUrl === "string" ? entry.directUrl : null
  const ext = typeof entry.ext === "string" ? entry.ext : null
  const protocol = typeof entry.protocol === "string" ? entry.protocol : null
  const isM3u8 = Boolean(protocol?.includes("m3u8")) || Boolean(directUrl?.includes(".m3u8"))
  const canDirectDownload = Boolean(directUrl) && !isM3u8 && (ext === "mp4" || directUrl?.includes(".mp4"))

  const videoAbsPath = getContentItemVideoPathAbs(item.id, videoIndex)

  let dl: { bytes: number; sha256: string }
  if (canDirectDownload) {
    try {
      dl = await downloadToFile(directUrl!, videoAbsPath, { overwrite: true, timeoutMs: 180_000 })
    } catch {
      dl = await ytDlpDownloadMp4(args.canonicalUrl, videoAbsPath, { overwrite: true, timeoutMs: 10 * 60_000 })
    }
  } else {
    dl = await ytDlpDownloadMp4(args.canonicalUrl, videoAbsPath, { overwrite: true, timeoutMs: 10 * 60_000 })
  }

  entry.download = {
    status: "ready",
    localPath: toProjectRelativePath(videoAbsPath),
    sha256: dl.sha256,
    bytes: dl.bytes,
    downloadedAt: new Date().toISOString(),
    error: null,
  }

  await prisma.contentItem.update({
    where: { id: args.contentItemId },
    data: {
      media: media as Prisma.InputJsonValue,
      captureStatus: "READY",
    },
  })
}

export async function ingestTweetUrl(args: {
  workspaceId: string
  poolId: string
  jobId?: string | null
  url: string
  notes?: string | null
  tagIds?: string[]
  mediaMode?: "link" | "download"
  options?: {
    ignoreReplies?: boolean
  }
}): Promise<IngestOutcome> {
  const parsed = parseTweetUrl(args.url)
  if (!parsed) {
    return { outcome: "failed", code: "INVALID_URL", error: "Invalid X/Twitter URL" }
  }

  const mediaMode = args.mediaMode === "download" ? "download" : "link"
  const tagIds = Array.isArray(args.tagIds) ? args.tagIds : []

  // 1. Fetch workspace settings for blacklist
  const workspace = await prisma.workspace.findUnique({
    where: { id: args.workspaceId },
    select: { settings: true },
  })

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settings = (workspace?.settings as any) || {}
  const blacklist = settings.blacklist || {}
  const blockedAuthors = (Array.isArray(blacklist.authors) ? blacklist.authors : []).map((a: string) => a.toLowerCase().replace('@', ''))
  const blockedKeywords = Array.isArray(blacklist.keywords) ? blacklist.keywords : []

  // 2. Pre-check author from URL
  if (parsed.authorHandle && blockedAuthors.includes(parsed.authorHandle.toLowerCase())) {
    return { outcome: "failed", code: "BLOCKED_BY_RULE", error: `Author @${parsed.authorHandle} is blacklisted` }
  }

  const existing = await prisma.contentItem.findUnique({
    where: { workspaceId_sourceId: { workspaceId: args.workspaceId, sourceId: parsed.tweetId } },
    select: { id: true },
  })
  if (existing) {
    if (tagIds.length > 0) {
      await prisma.contentItemTag.createMany({
        data: tagIds.map((tagId) => ({ contentItemId: existing.id, tagId })),
        skipDuplicates: true,
      })
    }

    if (mediaMode === "download") {
      try {
        await ensureExistingItemVideoDownloaded({ contentItemId: existing.id, canonicalUrl: parsed.canonicalUrl })
      } catch (e) {
        return { outcome: "failed", code: "DOWNLOAD_FAILED", error: getErrorMessage(e) }
      }
    }

    return { outcome: "deduped", contentItemId: existing.id }
  }

  try {
    let extracted: ReturnType<typeof extractTweetFromXGraphql> | ReturnType<typeof extractTweetFromYtDlp>
    let rawJson: unknown

    try {
      rawJson = await fetchXTweetGraphql(parsed.tweetId)
      extracted = extractTweetFromXGraphql(rawJson)
    } catch {
      rawJson = await ytDlpJson(parsed.canonicalUrl)
      extracted = extractTweetFromYtDlp(rawJson as Record<string, unknown>)
    }

    const authorHandle = extracted.authorHandle ?? parsed.authorHandle ?? "unknown"
    const textOriginal = extracted.text || ""

    // 3. Post-check author and keywords
    if (blockedAuthors.includes(authorHandle.toLowerCase().replace('@', ''))) {
      return { outcome: "failed", code: "BLOCKED_BY_RULE", error: `Author @${authorHandle} is blacklisted` }
    }

    // 4. Check Replies
    if (args.options?.ignoreReplies && "isReply" in extracted && extracted.isReply) {
      return { outcome: "failed", code: "SKIPPED_REPLY", error: "Skipped reply tweet" }
    }

    for (const keyword of blockedKeywords) {
      if (textOriginal.toLowerCase().includes(keyword.toLowerCase())) {
        return { outcome: "failed", code: "BLOCKED_BY_RULE", error: `Content contains blocked keyword: ${keyword}` }
      }
    }

    const media: Array<Record<string, unknown>> = []

    if ("video" in extracted && extracted.video) {
      media.push({
        type: "video",
        sourceUrl: parsed.canonicalUrl,
        directUrl: extracted.video.bestUrl,
        ext: extracted.video.ext,
        protocol: extracted.video.protocol,
        width: extracted.video.width,
        height: extracted.video.height,
        tbr: extracted.video.tbr,
        thumbnailUrl: extracted.video.thumbnailUrl,
        download: {
          status: mediaMode === "download" ? "queued" : "skipped",
          localPath: null,
          sha256: null,
          bytes: null,
          downloadedAt: null,
          error: null,
        },
      })
    } else if ("bestVideo" in extracted && extracted.bestVideo) {
      const best = extracted.bestVideo
      media.push({
        type: "video",
        sourceUrl: parsed.canonicalUrl,
        directUrl: best.url,
        formatId: best.formatId,
        ext: best.ext,
        protocol: best.protocol,
        width: best.width,
        height: best.height,
        tbr: best.tbr,
        filesize: best.filesize,
        download: {
          status: mediaMode === "download" ? "queued" : "skipped",
          localPath: null,
          sha256: null,
          bytes: null,
          downloadedAt: null,
          error: null,
        },
      })
    }

    if ("images" in extracted && Array.isArray(extracted.images)) {
      for (const img of extracted.images) {
        if (!img || typeof img !== "object") continue
        const directUrl = typeof (img as { url?: unknown }).url === "string" ? (img as { url: string }).url : null
        if (!directUrl) continue
        media.push({
          type: "image",
          sourceUrl: parsed.canonicalUrl,
          directUrl,
          width: typeof (img as { width?: unknown }).width === "number" ? (img as { width: number }).width : null,
          height: typeof (img as { height?: unknown }).height === "number" ? (img as { height: number }).height : null,
          alt: typeof (img as { alt?: unknown }).alt === "string" ? (img as { alt: string }).alt : null,
        })
      }
    }

    const videoIndex = media.findIndex((m) => isObject(m) && m.type === "video")

    const contentItem = await prisma.contentItem.create({
      data: {
        workspaceId: args.workspaceId,
        poolId: args.poolId,
        jobId: args.jobId ?? null,
        sourceId: parsed.tweetId,
        sourceUrl: parsed.canonicalUrl,
        authorHandle,
        authorName: extracted.authorName ?? null,
        authorAvatar: extracted.authorAvatar ?? null,
        textOriginal,
        lang: null,
        rawJson: rawJson as Prisma.InputJsonValue,
        media: media as Prisma.InputJsonValue,
        notes: args.notes ?? null,
        captureStatus: mediaMode === "download" && videoIndex !== -1 ? "FETCHING" : "READY",
      },
    })

    if (tagIds.length > 0) {
      await prisma.contentItemTag.createMany({
        data: tagIds.map((tagId) => ({ contentItemId: contentItem.id, tagId })),
        skipDuplicates: true,
      })
    }

    if (mediaMode === "download" && videoIndex !== -1) {
      const bestMedia = media[videoIndex]
      const directUrl = typeof bestMedia.directUrl === "string" ? bestMedia.directUrl : null

      const videoAbsPath = getContentItemVideoPathAbs(contentItem.id, videoIndex)
      try {
        const ext = typeof bestMedia.ext === "string" ? bestMedia.ext : null
        const protocol = typeof bestMedia.protocol === "string" ? bestMedia.protocol : null

        const isM3u8 = Boolean(protocol?.includes("m3u8")) || Boolean(directUrl?.includes(".m3u8"))
        const canDirectDownload = Boolean(directUrl) && !isM3u8 && (ext === "mp4" || directUrl?.includes(".mp4"))

        let dl: { bytes: number; sha256: string }
        if (canDirectDownload) {
          try {
            dl = await downloadToFile(directUrl!, videoAbsPath, { overwrite: true, timeoutMs: 180_000 })
          } catch {
            dl = await ytDlpDownloadMp4(parsed.canonicalUrl, videoAbsPath, { overwrite: true, timeoutMs: 10 * 60_000 })
          }
        } else {
          dl = await ytDlpDownloadMp4(parsed.canonicalUrl, videoAbsPath, { overwrite: true, timeoutMs: 10 * 60_000 })
        }

        bestMedia.download = {
          status: "ready",
          localPath: toProjectRelativePath(videoAbsPath),
          sha256: dl.sha256,
          bytes: dl.bytes,
          downloadedAt: new Date().toISOString(),
          error: null,
        }

        await prisma.contentItem.update({
          where: { id: contentItem.id },
          data: {
            media: media as Prisma.InputJsonValue,
            captureStatus: "READY",
          },
        })
      } catch (downloadError) {
        bestMedia.download = {
          status: "failed",
          localPath: null,
          sha256: null,
          bytes: null,
          downloadedAt: null,
          error: getErrorMessage(downloadError),
        }

        await prisma.contentItem.update({
          where: { id: contentItem.id },
          data: {
            media: media as Prisma.InputJsonValue,
            captureStatus: "FAILED",
          },
        })

        return { outcome: "failed", code: "DOWNLOAD_FAILED", error: getErrorMessage(downloadError) }
      }
    }

    return { outcome: "created", contentItemId: contentItem.id }
  } catch (e) {
    return { outcome: "failed", code: "INGEST_FAILED", error: getErrorMessage(e) }
  }
}

