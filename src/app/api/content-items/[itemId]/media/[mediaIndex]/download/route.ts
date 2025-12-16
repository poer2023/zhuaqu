import { NextRequest } from "next/server"
import path from "node:path"
import { createReadStream } from "node:fs"
import { stat } from "node:fs/promises"
import { Readable } from "node:stream"

import prisma from "@/lib/prisma"
import { getMediaDirAbs, resolveProjectPath } from "@/server/media/localStore"
import type { Prisma } from "@prisma/client"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ itemId: string; mediaIndex: string }> }
) {
  const { itemId, mediaIndex } = await params
  const index = Number.parseInt(mediaIndex, 10)
  if (!Number.isFinite(index) || index < 0) {
    return Response.json({ error: "Invalid mediaIndex" }, { status: 400 })
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    select: { id: true, workspaceId: true, poolId: true, sourceUrl: true, media: true },
  })
  if (!item) return Response.json({ error: "ContentItem not found" }, { status: 404 })

  const media = Array.isArray(item.media) ? item.media : []
  const entry = media[index]
  if (!isObject(entry)) return Response.json({ error: "Media not found" }, { status: 404 })
  if (entry.type !== "video") return Response.json({ error: "Media is not a video" }, { status: 400 })

  const download = isObject(entry.download) ? entry.download : {}
  const status = typeof download.status === "string" ? download.status : null
  const localPath = typeof download.localPath === "string" ? download.localPath : null

  if (status === "ready" && localPath) {
    return Response.json({ ok: true, status: "ready" })
  }

  entry.download = {
    ...download,
    status: "queued",
    error: null,
  }

  await prisma.contentItem.update({
    where: { id: item.id },
    data: {
      media: media as Prisma.InputJsonValue,
      captureStatus: "FETCHING",
    },
  })

  const job = await prisma.ingestJob.create({
    data: {
      workspaceId: item.workspaceId,
      poolId: item.poolId,
      urls: [item.sourceUrl],
      options: { mediaMode: "download", reason: "content_item_media_download", itemId: item.id, mediaIndex: index },
      tags: [],
      notes: null,
      status: "QUEUED",
      total: 1,
    },
  })

  await prisma.auditLog.create({
    data: {
      workspaceId: item.workspaceId,
      contentItemId: item.id,
      action: "INGEST_CREATED",
      details: { jobId: job.id, reason: "content_item_media_download", mediaIndex: index },
      actor: "owner",
    },
  })

  return Response.json({ ok: true, job })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string; mediaIndex: string }> }
) {
  const { itemId, mediaIndex } = await params
  const index = Number.parseInt(mediaIndex, 10)
  if (!Number.isFinite(index) || index < 0) {
    return Response.json({ error: "Invalid mediaIndex" }, { status: 400 })
  }

  const item = await prisma.contentItem.findUnique({
    where: { id: itemId },
    select: { id: true, sourceId: true, media: true },
  })
  if (!item) return Response.json({ error: "ContentItem not found" }, { status: 404 })

  const media = Array.isArray(item.media) ? item.media : []
  const entry = media[index]
  if (!isObject(entry)) return Response.json({ error: "Media not found" }, { status: 404 })

  const download = isObject(entry.download) ? entry.download : null
  const localPath = download && typeof download.localPath === "string" ? download.localPath : null
  const status = download && typeof download.status === "string" ? download.status : null

  if (!localPath || status !== "ready") {
    return Response.json({ error: "Media not downloaded yet" }, { status: 409 })
  }

  const mediaDir = path.resolve(getMediaDirAbs())
  const absPath = path.resolve(resolveProjectPath(localPath))
  if (!absPath.startsWith(mediaDir + path.sep)) {
    return Response.json({ error: "Invalid media path" }, { status: 400 })
  }

  let fileStat
  try {
    fileStat = await stat(absPath)
  } catch {
    return Response.json({ error: "File missing on disk" }, { status: 404 })
  }

  const fileName = `${item.sourceId}_video_${index}.mp4`
  const stream = createReadStream(absPath)

  return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileStat.size),
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  })
}
