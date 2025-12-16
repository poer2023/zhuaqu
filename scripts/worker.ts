import "dotenv/config"

import prisma from "../src/lib/prisma"
import { runIngestJob } from "../src/server/jobs/ingest"
import { claimNextStep, createJobWithSteps, markStepFailed } from "../src/server/orchestrator/orchestrator"

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function claimNextLegacyIngestJob(): Promise<string | null> {
  const job = await prisma.ingestJob.findFirst({
    where: { status: "QUEUED", jobId: null },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  })
  if (!job) return null

  const claimed = await prisma.ingestJob.updateMany({
    where: { id: job.id, status: "QUEUED" },
    data: { status: "RUNNING", startedAt: new Date() },
  })
  if (claimed.count !== 1) return null
  return job.id
}

async function runCaptureStep(stepId: string, jobId: string, jobType: string): Promise<void> {
  if (jobType === "INGEST_URL") {
    const ingestJob = await prisma.ingestJob.findUnique({ where: { jobId } })
    if (!ingestJob) {
      throw new Error(`IngestJob not found for orchestration job ${jobId}`)
    }
    await runIngestJob(ingestJob.id)
    return
  }

  throw new Error(`Unsupported CAPTURE handler for job type: ${jobType}`)
}

async function main() {
  const pollMs = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10)
  console.log(`[worker] started (poll=${pollMs}ms)`)

  while (true) {
    const step = await claimNextStep({ stepTypes: ["CAPTURE"], jobTypes: ["INGEST_URL"] })
    if (step) {
      console.log(`[worker] step claimed: ${step.id} (${step.type}) job=${step.job.id} type=${step.job.type}`)
      try {
        if (step.type === "CAPTURE") {
          await runCaptureStep(step.id, step.job.id, step.job.type)
        }
        console.log(`[worker] step done: ${step.id}`)
      } catch (e) {
        console.error(`[worker] step failed: ${step.id}`, e)
        await markStepFailed(step.id, e)
      }
      continue
    }

    const legacyIngestJobId = await claimNextLegacyIngestJob()
    if (legacyIngestJobId) {
      console.log(`[worker] legacy ingest job claimed: ${legacyIngestJobId}`)
      try {
        const ingestJob = await prisma.ingestJob.findUnique({ where: { id: legacyIngestJobId } })
        if (ingestJob && !ingestJob.jobId) {
          await prisma.$transaction(async (tx) => {
            const { job, steps } = await createJobWithSteps(
              {
                type: "INGEST_URL",
                workspaceId: ingestJob.workspaceId,
                poolId: ingestJob.poolId,
                config: {
                  ingestJobId: ingestJob.id,
                  urls: ingestJob.urls,
                  options: ingestJob.options,
                  tags: ingestJob.tags,
                  notes: ingestJob.notes ?? null,
                },
                steps: [
                  {
                    type: "CAPTURE",
                    status: "RUNNING",
                    maxAttempts: 3,
                    inputRef: { ingestJobId: ingestJob.id },
                    availableAt: new Date(),
                  },
                ],
              },
              tx
            )

            const stepId = steps[0]?.id
            await tx.ingestJob.update({ where: { id: ingestJob.id }, data: { jobId: job.id } })
            await tx.job.update({ where: { id: job.id }, data: { status: "RUNNING" } })
            if (stepId) {
              await tx.step.update({
                where: { id: stepId },
                data: { startedAt: new Date(), attemptCount: 1 },
              })
            }
          })
        }

        await runIngestJob(legacyIngestJobId)
        console.log(`[worker] legacy ingest job done: ${legacyIngestJobId}`)
      } catch (e) {
        console.error(`[worker] legacy ingest job crashed: ${legacyIngestJobId}`, e)
      }
      continue
    }

    await sleep(pollMs)
  }
}

main()
  .catch((e) => {
    console.error("[worker] fatal error", e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
