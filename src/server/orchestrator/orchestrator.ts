import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { getErrorCode, getErrorMessage, getErrorMeta } from "@/server/errors"
import {
  type Job,
  type OrchestratorJobStatus,
  type OrchestratorJobType,
  type OrchestratorStepStatus,
  type OrchestratorStepType,
  type Step,
} from "@prisma/client"

type JsonValue = Prisma.InputJsonValue

// ==================== Configuration ====================

const DEFAULT_LEASE_SECONDS = 60
const DEFAULT_HEARTBEAT_INTERVAL_MS = 20_000

// ==================== Helper Functions ====================

function nowPlusMs(ms: number): Date {
  return new Date(Date.now() + ms)
}

function computeBackoffMs(attemptCount: number): number {
  const base = 5_000
  const cappedAttempt = Math.max(1, Math.min(6, attemptCount))
  return base * Math.pow(3, cappedAttempt - 1)
}

function toStepError(error: unknown): JsonValue {
  const meta = getErrorMeta(error)
  return {
    code: meta.code,
    message: meta.message,
    retryable: meta.retryable,
    category: meta.category,
    raw: error instanceof Error ? (error.stack ?? error.message) : String(error),
    at: new Date().toISOString(),
  }
}

// ==================== Job Status Recomputation ====================

export async function recomputeJobStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
  const job = await tx.job.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  })
  if (!job) return
  if (job.status === "CANCELED") return

  const steps = await tx.step.findMany({
    where: { jobId },
    select: { status: true },
  })

  const statuses = steps.map((s) => s.status)
  const hasFailed = statuses.includes("FAILED")
  const hasRunning = statuses.includes("RUNNING")
  const hasQueued = statuses.includes("QUEUED")
  const allTerminal =
    statuses.length > 0 && statuses.every((s) => s === "SUCCEEDED" || s === "SKIPPED" || s === "FAILED")

  let next: OrchestratorJobStatus
  if (hasFailed) next = "FAILED"
  else if (hasRunning) next = "RUNNING"
  else if (hasQueued) next = "PENDING"
  else if (allTerminal) next = "DONE"
  else next = job.status

  if (next !== job.status) {
    await tx.job.update({ where: { id: jobId }, data: { status: next } })
  }
}

// ==================== Create Job with Steps ====================

export async function createJobWithSteps(args: {
  type: OrchestratorJobType
  workspaceId: string
  poolId?: string | null
  config?: JsonValue
  idempotencyKey?: string | null
  steps: Array<{
    type: OrchestratorStepType
    position?: number
    status?: OrchestratorStepStatus
    maxAttempts?: number
    inputRef?: JsonValue
    availableAt?: Date
    dependsOnStepId?: string | null
  }>
}, tx?: Prisma.TransactionClient): Promise<{ job: Job; steps: Step[] }> {
  const { type, workspaceId, poolId, config, idempotencyKey } = args

  const db = tx ?? prisma

  if (idempotencyKey) {
    const existing = await db.job.findUnique({
      where: { type_idempotencyKey: { type, idempotencyKey } },
      include: { steps: { orderBy: { position: "asc" } } },
    })
    if (existing) return { job: existing, steps: existing.steps }
  }

  const createInTx = async (dbTx: Prisma.TransactionClient) => {
    const job = await dbTx.job.create({
      data: {
        type,
        status: "PENDING",
        workspaceId,
        poolId: poolId ?? null,
        config: config ?? {},
        idempotencyKey: idempotencyKey ?? null,
        steps: {
          create: args.steps.map((s, idx) => ({
            type: s.type,
            position: s.position ?? idx,
            status: s.status ?? "QUEUED",
            maxAttempts: s.maxAttempts ?? 3,
            inputRef: s.inputRef ?? {},
            dependsOnStepId: s.dependsOnStepId ?? null,
            ...(s.availableAt ? { availableAt: s.availableAt } : {}),
          })),
        },
      },
      include: { steps: { orderBy: { position: "asc" } } },
    })

    const withTraceId = job.traceId
      ? job
      : await dbTx.job.update({
        where: { id: job.id },
        data: { traceId: job.id },
        include: { steps: { orderBy: { position: "asc" } } },
      })

    return withTraceId
  }

  const created = tx ? await createInTx(tx) : await prisma.$transaction(createInTx)

  return { job: created, steps: created.steps }
}

// ==================== Get Job Detail ====================

export async function getJobDetail(jobId: string): Promise<(Job & { steps: Step[] }) | null> {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: { steps: { orderBy: { position: "asc" } } },
  })
}

// ==================== Claim Next Step (Atomic with Lease) ====================

export async function claimNextStep(args: {
  stepTypes?: OrchestratorStepType[]
  jobTypes?: OrchestratorJobType[]
  workerId?: string
  leaseSeconds?: number
}): Promise<(Step & { job: Pick<Job, "id" | "type" | "status" | "workspaceId" | "poolId"> }) | null> {
  const now = new Date()
  const workerId = args.workerId || `worker-${process.pid}`
  const leaseSeconds = args.leaseSeconds ?? DEFAULT_LEASE_SECONDS
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000)
  const stepTypes = args.stepTypes
  const jobTypes = args.jobTypes

  return prisma.$transaction(async (tx) => {
    // 使用 FOR UPDATE SKIP LOCKED 实现原子领取
    // 由于 Prisma 不直接支持，我们用两步查询确保原子性
    const step = await tx.step.findFirst({
      where: {
        status: "QUEUED",
        availableAt: { lte: now },
        ...(stepTypes?.length ? { type: { in: stepTypes } } : {}),
        // 检查 step 依赖：如果有依赖，确保依赖已完成
        OR: [
          { dependsOnStepId: null },
          { dependsOnStep: { status: { in: ["SUCCEEDED", "SKIPPED"] } } },
        ],
        job: {
          status: { in: ["PENDING", "RUNNING"] },
          ...(jobTypes?.length ? { type: { in: jobTypes } } : {}),
        },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, jobId: true },
    })
    if (!step) return null

    // 原子更新 claim 状态
    const claimed = await tx.step.updateMany({
      where: { id: step.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: now,
        attemptCount: { increment: 1 },
        leaseOwner: workerId,
        leaseExpiresAt,
        heartbeatAt: now,
      },
    })
    if (claimed.count !== 1) return null

    // 更新 Job 状态
    await tx.job.updateMany({
      where: { id: step.jobId, status: "PENDING" },
      data: { status: "RUNNING" },
    })

    const full = await tx.step.findUnique({
      where: { id: step.id },
      include: { job: { select: { id: true, type: true, status: true, workspaceId: true, poolId: true } } },
    })
    return full
  })
}

// ==================== Lease Renewal ====================

export async function renewStepLease(
  stepId: string,
  workerId: string,
  leaseSeconds: number = DEFAULT_LEASE_SECONDS
): Promise<boolean> {
  const now = new Date()
  const leaseExpiresAt = new Date(now.getTime() + leaseSeconds * 1000)

  const result = await prisma.step.updateMany({
    where: {
      id: stepId,
      status: "RUNNING",
      leaseOwner: workerId,
    },
    data: {
      heartbeatAt: now,
      leaseExpiresAt,
    },
  })

  return result.count === 1
}

// ==================== Release Step Lease ====================

export async function releaseStepLease(
  stepId: string,
  workerId: string,
  reason: string = "worker_release"
): Promise<boolean> {
  const now = new Date()

  const result = await prisma.$transaction(async (tx) => {
    const step = await tx.step.findUnique({
      where: { id: stepId },
      select: { id: true, jobId: true, status: true, leaseOwner: true },
    })

    if (!step || step.status !== "RUNNING" || step.leaseOwner !== workerId) {
      return false
    }

    await tx.step.update({
      where: { id: stepId },
      data: {
        status: "QUEUED",
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        startedAt: null,
        error: {
          code: "STEP_RELEASED",
          message: `Step released by worker: ${reason}`,
          retryable: true,
          category: "internal",
          at: now.toISOString(),
        },
      },
    })

    await recomputeJobStatus(tx, step.jobId)
    return true
  })

  return result
}

// ==================== Mark Step Succeeded ====================

export async function markStepSucceeded(stepId: string, outputRef?: JsonValue): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.update({
      where: { id: stepId },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        ...(outputRef ? { outputRef } : {}),
        error: {},
      },
      select: { jobId: true },
    })
    await recomputeJobStatus(tx, step.jobId)
  })
}

// ==================== Mark Step Skipped ====================

export async function markStepSkipped(stepId: string, outputRef?: JsonValue): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.update({
      where: { id: stepId },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        ...(outputRef ? { outputRef } : {}),
      },
      select: { jobId: true },
    })
    await recomputeJobStatus(tx, step.jobId)
  })
}

// ==================== Mark Step Failed ====================

export async function markStepFailed(stepId: string, error: unknown): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.findUnique({
      where: { id: stepId },
      select: { id: true, jobId: true, attemptCount: true, maxAttempts: true },
    })
    if (!step) return

    const terminal = step.attemptCount >= step.maxAttempts
    const nextStatus: OrchestratorStepStatus = terminal ? "FAILED" : "QUEUED"

    await tx.step.update({
      where: { id: stepId },
      data: {
        status: nextStatus,
        availableAt: terminal ? new Date() : nowPlusMs(computeBackoffMs(step.attemptCount)),
        completedAt: terminal ? new Date() : null,
        leaseOwner: null,
        leaseExpiresAt: null,
        error: toStepError(error),
      },
    })

    await recomputeJobStatus(tx, step.jobId)
  })
}

// ==================== Mark Step Failed Terminal ====================

export async function markStepFailedTerminal(stepId: string, error: unknown): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.findUnique({
      where: { id: stepId },
      select: { jobId: true },
    })
    if (!step) return

    await tx.step.update({
      where: { id: stepId },
      data: {
        status: "FAILED",
        availableAt: new Date(),
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
        error: toStepError(error),
      },
    })

    await recomputeJobStatus(tx, step.jobId)
  })
}

// ==================== Retry Step ====================

export async function retryStep(stepId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const run = async (dbTx: Prisma.TransactionClient) => {
    const step = await dbTx.step.update({
      where: { id: stepId },
      data: {
        status: "QUEUED",
        availableAt: new Date(),
        startedAt: null,
        completedAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        error: {},
        outputRef: {},
      },
      select: { jobId: true },
    })
    await recomputeJobStatus(dbTx, step.jobId)
  }

  if (tx) {
    await run(tx)
    return
  }

  await prisma.$transaction(run)
}

// ==================== Rerun From Step ====================

export async function rerunFrom(
  jobId: string,
  stepId: string,
  options?: { clearOutput?: boolean },
  tx?: Prisma.TransactionClient
): Promise<void> {
  const clearOutput = options?.clearOutput ?? true

  const run = async (dbTx: Prisma.TransactionClient) => {
    const target = await dbTx.step.findUnique({
      where: { id: stepId },
      select: { id: true, jobId: true, position: true },
    })
    if (!target || target.jobId !== jobId) return

    await dbTx.step.updateMany({
      where: { jobId, position: { gte: target.position } },
      data: {
        status: "QUEUED",
        availableAt: new Date(),
        startedAt: null,
        completedAt: null,
        leaseOwner: null,
        leaseExpiresAt: null,
        heartbeatAt: null,
        error: {},
        ...(clearOutput ? { outputRef: {} } : {}),
      },
    })

    await recomputeJobStatus(dbTx, jobId)
  }

  if (tx) {
    await run(tx)
    return
  }

  await prisma.$transaction(run)
}

// ==================== Pause Job ====================

export async function pauseJob(jobId: string): Promise<boolean> {
  const result = await prisma.job.updateMany({
    where: {
      id: jobId,
      status: { in: ["PENDING", "RUNNING"] },
    },
    data: { status: "PAUSED" },
  })
  return result.count === 1
}

// ==================== Resume Job ====================

export async function resumeJob(jobId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    })
    if (!job || job.status !== "PAUSED") return false

    await tx.job.update({
      where: { id: jobId },
      data: { status: "PENDING" },
    })

    // 重新激活所有 QUEUED 的 steps
    await tx.step.updateMany({
      where: { jobId, status: "QUEUED" },
      data: { availableAt: new Date() },
    })

    await recomputeJobStatus(tx, jobId)
    return true
  })
}

// ==================== Cancel Job ====================

export async function cancelJob(jobId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.job.findUnique({
      where: { id: jobId },
      select: { id: true, status: true },
    })
    if (!job) return false
    if (job.status === "DONE" || job.status === "CANCELED") return false

    await tx.job.update({
      where: { id: jobId },
      data: { status: "CANCELED" },
    })

    // 将所有非终态的 steps 标记为 SKIPPED
    await tx.step.updateMany({
      where: {
        jobId,
        status: { in: ["QUEUED", "RUNNING"] },
      },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        leaseOwner: null,
        leaseExpiresAt: null,
      },
    })

    return true
  })
}

// ==================== Check Job Status (for long-running handlers) ====================

export async function shouldContinue(jobId: string): Promise<boolean> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    select: { status: true },
  })
  if (!job) return false
  return job.status === "RUNNING" || job.status === "PENDING"
}

// ==================== Export Configuration ====================

export { DEFAULT_LEASE_SECONDS, DEFAULT_HEARTBEAT_INTERVAL_MS }
