import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"
import { getErrorCode, getErrorMessage } from "@/server/errors"
import {
  type Job,
  type OrchestratorJobStatus,
  type OrchestratorJobType,
  type OrchestratorStepStatus,
  type OrchestratorStepType,
  type Step,
} from "@prisma/client"

type JsonValue = Prisma.InputJsonValue

function nowPlusMs(ms: number): Date {
  return new Date(Date.now() + ms)
}

function computeBackoffMs(attemptCount: number): number {
  const base = 5_000
  const cappedAttempt = Math.max(1, Math.min(6, attemptCount))
  return base * Math.pow(3, cappedAttempt - 1)
}

function toStepError(error: unknown): JsonValue {
  return {
    code: getErrorCode(error),
    message: getErrorMessage(error),
    raw: error instanceof Error ? (error.stack ?? error.message) : String(error),
    at: new Date().toISOString(),
  }
}

async function recomputeJobStatus(tx: Prisma.TransactionClient, jobId: string): Promise<void> {
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

export async function getJobDetail(jobId: string): Promise<(Job & { steps: Step[] }) | null> {
  return prisma.job.findUnique({
    where: { id: jobId },
    include: { steps: { orderBy: { position: "asc" } } },
  })
}

export async function claimNextStep(args: {
  stepTypes?: OrchestratorStepType[]
  jobTypes?: OrchestratorJobType[]
}): Promise<(Step & { job: Pick<Job, "id" | "type" | "status" | "workspaceId" | "poolId"> }) | null> {
  const now = new Date()
  const stepTypes = args.stepTypes
  const jobTypes = args.jobTypes

  return prisma.$transaction(async (tx) => {
    const step = await tx.step.findFirst({
      where: {
        status: "QUEUED",
        availableAt: { lte: now },
        ...(stepTypes?.length ? { type: { in: stepTypes } } : {}),
        job: {
          status: { in: ["PENDING", "RUNNING"] },
          ...(jobTypes?.length ? { type: { in: jobTypes } } : {}),
        },
      },
      orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
      select: { id: true, jobId: true },
    })
    if (!step) return null

    const claimed = await tx.step.updateMany({
      where: { id: step.id, status: "QUEUED" },
      data: {
        status: "RUNNING",
        startedAt: now,
        attemptCount: { increment: 1 },
      },
    })
    if (claimed.count !== 1) return null

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

export async function markStepSucceeded(stepId: string, outputRef?: JsonValue): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.update({
      where: { id: stepId },
      data: {
        status: "SUCCEEDED",
        completedAt: new Date(),
        ...(outputRef ? { outputRef } : {}),
        error: {},
      },
      select: { jobId: true },
    })
    await recomputeJobStatus(tx, step.jobId)
  })
}

export async function markStepSkipped(stepId: string, outputRef?: JsonValue): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const step = await tx.step.update({
      where: { id: stepId },
      data: {
        status: "SKIPPED",
        completedAt: new Date(),
        ...(outputRef ? { outputRef } : {}),
      },
      select: { jobId: true },
    })
    await recomputeJobStatus(tx, step.jobId)
  })
}

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
        error: toStepError(error),
      },
    })

    await recomputeJobStatus(tx, step.jobId)
  })
}

export async function retryStep(stepId: string, tx?: Prisma.TransactionClient): Promise<void> {
  const run = async (dbTx: Prisma.TransactionClient) => {
    const step = await dbTx.step.update({
      where: { id: stepId },
      data: {
        status: "QUEUED",
        availableAt: new Date(),
        startedAt: null,
        completedAt: null,
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

export async function rerunFrom(jobId: string, stepId: string, tx?: Prisma.TransactionClient): Promise<void> {
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
        error: {},
        outputRef: {},
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
