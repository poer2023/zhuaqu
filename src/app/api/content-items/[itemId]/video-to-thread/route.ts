import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import { stat } from "node:fs/promises"

import prisma from "@/lib/prisma"
import { generateThreadFromVideo } from "@/server/ai/gemini"
import { getMediaDirAbs, resolveProjectPath } from "@/server/media/localStore"

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  try {
    const { itemId } = await params
    const body = await request.json().catch(() => ({}))

    const maxTweets = typeof body.maxTweets === "number" ? body.maxTweets : 7
    const language = body.language === "en" ? "en" : "zh"

    const item = await prisma.contentItem.findUnique({
      where: { id: itemId },
      select: { id: true, workspaceId: true, authorHandle: true, sourceUrl: true, textOriginal: true, media: true },
    })
    if (!item) return NextResponse.json({ error: "ContentItem not found" }, { status: 404 })

    const media = Array.isArray(item.media) ? item.media : []
    const firstVideo = media.find((m) => isObject(m) && m.type === "video")
    if (!firstVideo || !isObject(firstVideo)) {
      return NextResponse.json({ error: "No downloaded video found for this item" }, { status: 400 })
    }

    const download = isObject(firstVideo.download) ? firstVideo.download : null
    const localPath = download && typeof download.localPath === "string" ? download.localPath : null

    if (!localPath) {
      return NextResponse.json({ error: "No downloaded video found for this item" }, { status: 400 })
    }

    const mediaDir = path.resolve(getMediaDirAbs())
    const absPath = path.resolve(resolveProjectPath(localPath))
    if (!absPath.startsWith(mediaDir + path.sep)) {
      return NextResponse.json({ error: "Invalid media path" }, { status: 400 })
    }

    await stat(absPath)

    const draft = await generateThreadFromVideo({
      videoPath: absPath,
      sourceUrl: item.sourceUrl,
      authorHandle: item.authorHandle,
      originalText: item.textOriginal,
      maxTweets,
      language,
    })

    const last = await prisma.rewriteVersion.findFirst({
      where: { contentItemId: item.id },
      select: { version: true },
      orderBy: { version: "desc" },
    })
    const nextVersion = (last?.version ?? 0) + 1

    const version = await prisma.rewriteVersion.create({
      data: {
        contentItemId: item.id,
        version: nextVersion,
        output: draft,
        outputFormat: "thread",
        paramsSnapshot: {
          inputMode: "video",
          maxTweets,
          language,
          model: process.env.GEMINI_MODEL || null,
        },
        status: "GENERATED",
        charCount: draft.tweets.reduce((sum, t) => sum + t.text.length, 0),
      },
    })

    await prisma.contentItem.update({
      where: { id: item.id },
      data: { rewriteStatus: "GENERATED" },
    })

    await prisma.auditLog.create({
      data: {
        workspaceId: item.workspaceId,
        contentItemId: item.id,
        action: "REWRITE_GENERATED",
        details: { versionId: version.id, inputMode: "video" },
        actor: "system",
      },
    })

    return NextResponse.json({ version })
  } catch (error) {
    console.error("video-to-thread failed:", error)
    return NextResponse.json({ error: "Failed to generate thread from video" }, { status: 500 })
  }
}
