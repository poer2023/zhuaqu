import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { retryStep } from "@/server/orchestrator"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params

    const step = await prisma.step.findUnique({
      where: { id: stepId },
      include: { job: true },
    })
    if (!step) {
      return NextResponse.json({ error: "Step not found" }, { status: 404 })
    }

    await prisma.$transaction(async (tx) => {
      await retryStep(stepId, tx)

      if (step.job.type === "INGEST_URL") {
        const ingestJob = await tx.ingestJob.findUnique({ where: { jobId: step.jobId } })
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

      if (step.job.type === "SYNC_LIKES" || step.job.type === "SYNC_BOOKMARKS" || step.job.type === "SYNC_TIMELINE") {
        const syncJob = await tx.syncJob.findUnique({ where: { jobId: step.jobId } })
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

      if (step.job.type === "PUBLISH") {
        const publishJob = await tx.publishJob.findUnique({ where: { jobId: step.jobId } })
        if (publishJob) {
          await tx.publishJob.update({
            where: { id: publishJob.id },
            data: {
              status: "QUEUED",
              lastError: null,
            },
          })
        }
      }
    })

    const updated = await prisma.step.findUnique({
      where: { id: stepId },
      include: { job: { include: { steps: { orderBy: { position: "asc" } } } } },
    })

    return NextResponse.json({ step: updated })
  } catch (error) {
    console.error("Failed to retry step:", error)
    return NextResponse.json({ error: "Failed to retry step" }, { status: 500 })
  }
}

