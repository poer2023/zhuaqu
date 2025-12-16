import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { rerunFrom } from "@/server/orchestrator"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const body = await request.json().catch(() => ({}))
    const stepId = typeof body.stepId === "string" ? body.stepId : null

    if (!stepId) {
      return NextResponse.json({ error: "stepId is required" }, { status: 400 })
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await rerunFrom(jobId, stepId, tx)

      if (job.type === "INGEST_URL") {
        const ingestJob = await tx.ingestJob.findUnique({ where: { jobId } })
        if (ingestJob) {
          await tx.ingestJob.update({
            where: { id: ingestJob.id },
            data: {
              status: "QUEUED",
              startedAt: null,
              completedAt: null,
              succeeded: 0,
              failed: 0,
              deduped: 0,
              failures: [],
            },
          })
        }
      }

      if (job.type === "SYNC_LIKES" || job.type === "SYNC_BOOKMARKS" || job.type === "SYNC_TIMELINE") {
        const syncJob = await tx.syncJob.findUnique({ where: { jobId } })
        if (syncJob) {
          await tx.syncJob.update({
            where: { id: syncJob.id },
            data: {
              status: "PENDING",
              error: null,
              startedAt: null,
              completedAt: null,
            },
          })
        }
      }
    })

    const updated = await prisma.job.findUnique({
      where: { id: jobId },
      include: { steps: { orderBy: { position: "asc" } } },
    })

    return NextResponse.json({ job: updated })
  } catch (error) {
    console.error("Failed to rerun job from step:", error)
    return NextResponse.json({ error: "Failed to rerun job from step" }, { status: 500 })
  }
}

