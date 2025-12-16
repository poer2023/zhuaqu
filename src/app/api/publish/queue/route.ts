import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getPaused(settings: unknown): boolean {
  if (!isRecord(settings)) return false
  return settings.publishQueuePaused === true
}

function mergePaused(settings: unknown, paused: boolean): Prisma.InputJsonValue {
  const base = isRecord(settings) ? settings : {}
  return { ...base, publishQueuePaused: paused } as Prisma.InputJsonValue
}

// GET /api/publish/queue?workspaceId=xxx - 读取发布队列开关
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 })
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } })
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    return NextResponse.json({ paused: getPaused(workspace.settings) })
  } catch (error) {
    console.error("Failed to fetch publish queue state:", error)
    return NextResponse.json({ error: "Failed to fetch publish queue state" }, { status: 500 })
  }
}

// POST /api/publish/queue - { workspaceId, action: "pause" | "resume" }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : null
    const action = typeof body.action === "string" ? body.action : null

    if (!workspaceId || (action !== "pause" && action !== "resume")) {
      return NextResponse.json({ error: "workspaceId and action(pause|resume) are required" }, { status: 400 })
    }

    const paused = action === "pause"

    await prisma.$transaction(async (tx) => {
      const workspace = await tx.workspace.findUnique({ where: { id: workspaceId }, select: { settings: true } })
      if (!workspace) {
        throw new Error("Workspace not found")
      }

      await tx.workspace.update({
        where: { id: workspaceId },
        data: { settings: mergePaused(workspace.settings, paused) },
      })

      if (paused) {
        await tx.job.updateMany({
          where: { workspaceId, type: "PUBLISH", status: { in: ["PENDING", "RUNNING"] } },
          data: { status: "PAUSED" },
        })
      } else {
        await tx.job.updateMany({
          where: { workspaceId, type: "PUBLISH", status: "PAUSED" },
          data: { status: "PENDING" },
        })
      }
    })

    return NextResponse.json({ paused })
  } catch (error) {
    console.error("Failed to update publish queue state:", error)
    return NextResponse.json({ error: "Failed to update publish queue state" }, { status: 500 })
  }
}

