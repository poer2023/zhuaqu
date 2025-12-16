import prisma from "@/lib/prisma"
import type { Prisma } from "@prisma/client"

// ==================== Backoff Computation ====================

function computeBackoffMs(attemptCount: number): number {
    const base = 5_000
    const cappedAttempt = Math.max(1, Math.min(6, attemptCount))
    return base * Math.pow(3, cappedAttempt - 1)
}

function nowPlusMs(ms: number): Date {
    return new Date(Date.now() + ms)
}

// ==================== Job Status Recomputation ====================

async function recomputeJobStatus(
    tx: Prisma.TransactionClient,
    jobId: string
): Promise<void> {
    const job = await tx.job.findUnique({
        where: { id: jobId },
        select: { id: true, status: true },
    })
    if (!job || job.status === "CANCELED") return

    const steps = await tx.step.findMany({
        where: { jobId },
        select: { status: true },
    })

    const statuses = steps.map((s) => s.status)
    const hasFailed = statuses.includes("FAILED")
    const hasRunning = statuses.includes("RUNNING")
    const hasQueued = statuses.includes("QUEUED")
    const allTerminal =
        statuses.length > 0 &&
        statuses.every((s) => s === "SUCCEEDED" || s === "SKIPPED" || s === "FAILED")

    type JobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"
    let next: JobStatus

    if (hasFailed) next = "FAILED"
    else if (hasRunning) next = "RUNNING"
    else if (hasQueued) next = "PENDING"
    else if (allTerminal) next = "DONE"
    else next = job.status as JobStatus

    if (next !== job.status) {
        await tx.job.update({ where: { id: jobId }, data: { status: next } })
    }
}

// ==================== Recover Stale Steps ====================

export async function recoverStaleSteps(): Promise<{
    recovered: number
    details: Array<{ stepId: string; jobId: string; terminal: boolean }>
}> {
    const now = new Date()
    const details: Array<{ stepId: string; jobId: string; terminal: boolean }> = []

    // 找出 lease 已过期的 RUNNING steps
    const staleSteps = await prisma.step.findMany({
        where: {
            status: "RUNNING",
            leaseExpiresAt: { lt: now },
        },
        select: {
            id: true,
            jobId: true,
            attemptCount: true,
            maxAttempts: true,
            leaseOwner: true,
        },
    })

    if (staleSteps.length === 0) {
        return { recovered: 0, details: [] }
    }

    for (const step of staleSteps) {
        const terminal = step.attemptCount >= step.maxAttempts

        await prisma.$transaction(async (tx) => {
            await tx.step.update({
                where: { id: step.id },
                data: {
                    status: terminal ? "FAILED" : "QUEUED",
                    leaseOwner: null,
                    leaseExpiresAt: null,
                    heartbeatAt: null,
                    availableAt: terminal ? now : nowPlusMs(computeBackoffMs(step.attemptCount)),
                    completedAt: terminal ? now : null,
                    error: {
                        code: "LEASE_EXPIRED",
                        message: `Worker lease expired (owner: ${step.leaseOwner || "unknown"}), step recovered by watchdog`,
                        retryable: !terminal,
                        category: "timeout",
                        at: now.toISOString(),
                    } as Prisma.InputJsonValue,
                },
            })

            await recomputeJobStatus(tx, step.jobId)
        })

        details.push({ stepId: step.id, jobId: step.jobId, terminal })
    }

    return { recovered: staleSteps.length, details }
}

// ==================== Watchdog Runner ====================

let isRunning = false
let shouldStop = false

export async function startWatchdog(options?: {
    intervalMs?: number
    onRecovered?: (count: number, details: Array<{ stepId: string; jobId: string; terminal: boolean }>) => void
}): Promise<void> {
    const intervalMs = options?.intervalMs ?? 30_000

    if (isRunning) {
        console.warn("[watchdog] already running")
        return
    }

    isRunning = true
    shouldStop = false
    console.log(`[watchdog] started (interval=${intervalMs}ms)`)

    while (!shouldStop) {
        try {
            const { recovered, details } = await recoverStaleSteps()

            if (recovered > 0) {
                console.log(`[watchdog] recovered ${recovered} stale steps`)
                options?.onRecovered?.(recovered, details)
            }
        } catch (e) {
            console.error("[watchdog] error during recovery:", e)
        }

        await new Promise((r) => setTimeout(r, intervalMs))
    }

    isRunning = false
    console.log("[watchdog] stopped")
}

export function stopWatchdog(): void {
    shouldStop = true
}

export function isWatchdogRunning(): boolean {
    return isRunning
}

// ==================== CLI Entry Point ====================

if (require.main === module) {
    // 作为独立进程运行
    const intervalMs = parseInt(process.env.WATCHDOG_INTERVAL_MS || "30000", 10)

    process.on("SIGINT", () => {
        console.log("[watchdog] received SIGINT, stopping...")
        stopWatchdog()
    })

    process.on("SIGTERM", () => {
        console.log("[watchdog] received SIGTERM, stopping...")
        stopWatchdog()
    })

    startWatchdog({
        intervalMs,
        onRecovered: (count, details) => {
            for (const d of details) {
                console.log(`  - step=${d.stepId} job=${d.jobId} terminal=${d.terminal}`)
            }
        },
    })
        .catch((e) => {
            console.error("[watchdog] fatal error:", e)
            process.exitCode = 1
        })
        .finally(async () => {
            await prisma.$disconnect()
        })
}
