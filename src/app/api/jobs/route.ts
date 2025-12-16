import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

type OrchestratorJobStatusType = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"
type OrchestratorJobTypeType =
  | "INGEST_URL"
  | "SYNC_LIKES"
  | "SYNC_BOOKMARKS"
  | "SYNC_TIMELINE"
  | "REWRITE"
  | "PUBLISH"
  | "PIPELINE"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")
    const poolId = searchParams.get("poolId")
    const type = searchParams.get("type") as OrchestratorJobTypeType | null
    const status = searchParams.get("status") as OrchestratorJobStatusType | null
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))

    const jobs = await prisma.job.findMany({
      where: {
        ...(workspaceId && { workspaceId }),
        ...(poolId && { poolId }),
        ...(type && { type }),
        ...(status && { status }),
      },
      include: {
        steps: {
          orderBy: { position: "asc" },
          select: {
            id: true,
            type: true,
            status: true,
            position: true,
            attemptCount: true,
            maxAttempts: true,
            createdAt: true,
            startedAt: true,
            completedAt: true,
            error: true,
          },
        },
        workspace: { select: { id: true, name: true } },
        pool: { select: { id: true, name: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ jobs })
  } catch (error) {
    console.error("Failed to fetch jobs:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}

