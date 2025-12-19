import "dotenv/config"
import { randomUUID } from "crypto"

import prisma from "../src/lib/prisma"
import { runIngestJob } from "../src/server/jobs/ingest"
import {
  claimNextStep,
  createJobWithSteps,
  markStepFailed,
  renewStepLease,
  releaseStepLease,
  DEFAULT_LEASE_SECONDS,
  DEFAULT_HEARTBEAT_INTERVAL_MS,
} from "../src/server/orchestrator/orchestrator"
import {
  handleCaptureStep,
  handleExtractStep,
  handleMediaStep,
  handleRewriteStep,
  handleQAStep,
  handleScheduleStep,
  handlePublishStep,
} from "../src/server/orchestrator/handlers"

// ==================== Worker Configuration ====================

const WORKER_ID = `w-${randomUUID().slice(0, 8)}`
const LEASE_SECONDS = parseInt(process.env.WORKER_LEASE_SECONDS || String(DEFAULT_LEASE_SECONDS), 10)
const HEARTBEAT_INTERVAL_MS = parseInt(
  process.env.WORKER_HEARTBEAT_INTERVAL_MS || String(DEFAULT_HEARTBEAT_INTERVAL_MS),
  10
)
const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || "2000", 10)

// ==================== State ====================

let currentStepId: string | null = null
let heartbeatTimer: NodeJS.Timeout | null = null
let isShuttingDown = false

// ==================== Helper Functions ====================

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

// ==================== Heartbeat Management ====================

function startHeartbeat(stepId: string) {
  currentStepId = stepId
  heartbeatTimer = setInterval(async () => {
    if (isShuttingDown || !currentStepId) return

    try {
      const renewed = await renewStepLease(currentStepId, WORKER_ID, LEASE_SECONDS)
      if (!renewed) {
        console.warn(`[worker] failed to renew lease for step ${currentStepId}`)
      }
    } catch (e) {
      console.error(`[worker] heartbeat error for step ${currentStepId}:`, e)
    }
  }, HEARTBEAT_INTERVAL_MS)
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }
  currentStepId = null
}

// ==================== Graceful Shutdown ====================

async function gracefulShutdown(signal: string) {
  if (isShuttingDown) return
  isShuttingDown = true

  console.log(`[worker] received ${signal}, shutting down gracefully...`)

  if (currentStepId) {
    console.log(`[worker] releasing step ${currentStepId}`)
    try {
      await releaseStepLease(currentStepId, WORKER_ID, `shutdown_${signal}`)
      console.log(`[worker] step ${currentStepId} released successfully`)
    } catch (e) {
      console.error(`[worker] failed to release step ${currentStepId}:`, e)
    }
  }

  stopHeartbeat()

  try {
    await prisma.$disconnect()
  } catch (e) {
    console.error("[worker] error disconnecting from database:", e)
  }

  console.log("[worker] shutdown complete")
  process.exit(0)
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"))
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"))

// ==================== Legacy Ingest Job Support ====================

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

// ==================== Worker Role ====================

type WorkerRole = "all" | "capture" | "pipeline" | "publish"

function getWorkerRole(): WorkerRole {
  const raw = (process.env.WORKER_ROLE || "all").toLowerCase()
  if (raw === "capture" || raw === "pipeline" || raw === "publish") return raw
  return "all"
}

type StepType = "CAPTURE" | "EXTRACT" | "MEDIA" | "REWRITE" | "QA" | "SCHEDULE" | "PUBLISH"
type JobType = "INGEST_URL" | "SYNC_LIKES" | "SYNC_BOOKMARKS" | "SYNC_TIMELINE" | "REWRITE" | "PUBLISH" | "PIPELINE"

type ClaimConfig = {
  stepTypes: StepType[]
  jobTypes: JobType[]
}

function getClaimOrder(role: WorkerRole): ClaimConfig[] {
  switch (role) {
    case "capture":
      return [
        {
          stepTypes: ["CAPTURE", "EXTRACT", "MEDIA"],
          jobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE"],
        },
      ]
    case "pipeline":
      return [
        { stepTypes: ["REWRITE", "QA"], jobTypes: ["REWRITE", "PIPELINE"] },
      ]
    case "publish":
      return [
        { stepTypes: ["SCHEDULE", "PUBLISH"], jobTypes: ["PUBLISH", "PIPELINE"] },
      ]
    default:
      return [
        { stepTypes: ["PUBLISH", "SCHEDULE"], jobTypes: ["PUBLISH", "PIPELINE"] },
        { stepTypes: ["REWRITE", "QA"], jobTypes: ["REWRITE", "PIPELINE"] },
        {
          stepTypes: ["CAPTURE", "EXTRACT", "MEDIA"],
          jobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"],
        },
      ]
  }
}

// ==================== Step Handlers ====================

async function executeStep(step: Awaited<ReturnType<typeof claimNextStep>>): Promise<void> {
  if (!step) return

  switch (step.type) {
    case "CAPTURE":
      await handleCaptureStep(step)
      break
    case "EXTRACT":
      await handleExtractStep(step)
      break
    case "MEDIA":
      await handleMediaStep(step)
      break
    case "REWRITE":
      await handleRewriteStep(step)
      break
    case "QA":
      await handleQAStep(step)
      break
    case "SCHEDULE":
      await handleScheduleStep(step)
      break
    case "PUBLISH":
      await handlePublishStep(step)
      break
    default:
      throw new Error(`Unsupported step type: ${step.type}`)
  }
}

// ==================== Main Loop ====================

async function main() {
  const role = getWorkerRole()
  const claimOrder = getClaimOrder(role)

  console.log(`[worker] started`)
  console.log(`  id: ${WORKER_ID}`)
  console.log(`  role: ${role}`)
  console.log(`  lease: ${LEASE_SECONDS}s`)
  console.log(`  heartbeat: ${HEARTBEAT_INTERVAL_MS}ms`)
  console.log(`  poll: ${POLL_INTERVAL_MS}ms`)
  console.log(`  supported steps: ${claimOrder.flatMap((c) => c.stepTypes).join(", ")}`)

  while (!isShuttingDown) {
    let step = null as Awaited<ReturnType<typeof claimNextStep>> | null

    // 尝试按优先级领取 step
    for (const config of claimOrder) {
      if (isShuttingDown) break

      step = await claimNextStep({
        stepTypes: config.stepTypes,
        jobTypes: config.jobTypes,
        workerId: WORKER_ID,
        leaseSeconds: LEASE_SECONDS,
      })
      if (step) break
    }

    if (step) {
      console.log(
        `[worker] step claimed: ${step.id} (${step.type}) job=${step.job.id} type=${step.job.type}`
      )
      startHeartbeat(step.id)

      try {
        await executeStep(step)
        console.log(`[worker] step done: ${step.id}`)
      } catch (e) {
        console.error(`[worker] step failed: ${step.id}`, e)
        try {
          await markStepFailed(step.id, e)
        } catch (markError) {
          console.error(`[worker] failed to mark step as failed: ${step.id}`, markError)
        }
      } finally {
        stopHeartbeat()
      }

      continue
    }

    // 处理 legacy ingest jobs
    if (!isShuttingDown && (role === "all" || role === "capture")) {
      const legacyIngestJobId = await claimNextLegacyIngestJob()
      if (legacyIngestJobId) {
        console.log(`[worker] legacy ingest job claimed: ${legacyIngestJobId}`)
        try {
          const ingestJob = await prisma.ingestJob.findUnique({ where: { id: legacyIngestJobId } })
          if (ingestJob && !ingestJob.jobId) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await prisma.$transaction(async (tx: any) => {
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
                  data: {
                    startedAt: new Date(),
                    attemptCount: 1,
                    leaseOwner: WORKER_ID,
                    leaseExpiresAt: new Date(Date.now() + LEASE_SECONDS * 1000),
                    heartbeatAt: new Date(),
                  },
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
    }

    // 没有任务，等待
    await sleep(POLL_INTERVAL_MS)
  }
}

// ==================== Export for testing ====================

export {
  WORKER_ID,
  gracefulShutdown,
  startHeartbeat,
  stopHeartbeat,
}

// ==================== Entry Point ====================

main()
  .catch((e) => {
    console.error("[worker] fatal error", e)
    process.exitCode = 1
  })
  .finally(async () => {
    if (!isShuttingDown) {
      await prisma.$disconnect()
    }
  })
