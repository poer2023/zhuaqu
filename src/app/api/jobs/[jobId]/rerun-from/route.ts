import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { rerunFrom } from "@/server/orchestrator"

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params
    const body = await request.json().catch(() => ({}))
    const stepId = typeof body.stepId === "string" ? body.stepId : null
    const clearOutput = body.clearOutput !== false // 默认 true

    if (!stepId) {
      return NextResponse.json({ error: "stepId is required" }, { status: 400 })
    }

    const job = await prisma.job.findUnique({ where: { id: jobId } })
    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await prisma.$transaction(async (tx: any) => {
      await rerunFrom(jobId, stepId, { clearOutput }, tx)

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

      if (job.type === "PUBLISH") {
        const publishJob = await tx.publishJob.findUnique({
          where: { jobId },
          include: { rewriteVersion: { select: { contentItemId: true } } },
        })
        if (publishJob) {
          await tx.publishResult.deleteMany({ where: { publishJobId: publishJob.id } })
          await tx.publishJob.update({
            where: { id: publishJob.id },
            data: {
              status: "QUEUED",
              lastError: null,
              resultMap: {} as JsonValue,
              startedAt: null,
              completedAt: null,
            },
          })
          await tx.contentItem.update({
            where: { id: publishJob.rewriteVersion.contentItemId },
            data: { publishStatus: "QUEUED" },
          })
        }
      }

      if (job.type === "REWRITE") {
        const batch = await tx.rewriteBatch.findUnique({ where: { jobId }, select: { id: true } })
        if (batch) {
          await tx.rewriteBatch.update({
            where: { id: batch.id },
            data: {
              status: "QUEUED",
              startedAt: null,
              completedAt: null,
              succeeded: 0,
              failed: 0,
            },
          })
        }

        const versions = await tx.rewriteVersion.findMany({ where: { jobId }, select: { id: true, contentItemId: true } })
        if (versions.length > 0) {
          await tx.rewriteVersion.updateMany({
            where: { id: { in: versions.map((v: { id: string }) => v.id) } },
            data: { status: "DRAFTING" }
          })
          await tx.contentItem.updateMany({
            where: { id: { in: versions.map((v: { contentItemId: string }) => v.contentItemId) } },
            data: { rewriteStatus: "DRAFTING" }
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
