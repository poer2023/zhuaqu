import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"

type JobStats = {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
}

type StepStats = {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    avgDurationMs: number | null
}

type RecentFailure = {
    id: string
    jobId: string
    type: string
    status: string
    error: string | null
    createdAt: string
}

type DashboardData = {
    jobs: JobStats
    steps: StepStats
    recentFailures: RecentFailure[]
    ingestJobs: {
        total: number
        succeeded: number
        failed: number
        running: number
    }
    contentItems: {
        total: number
        byStatus: Record<string, number>
    }
    lastUpdated: string
}

export async function GET(): Promise<NextResponse<DashboardData>> {
    // OPT-M1: Use groupBy aggregation instead of full-table scan + memory aggregation

    // Job statistics using groupBy
    const [jobStatusStats, jobTypeStats, jobCount] = await Promise.all([
        prisma.job.groupBy({
            by: ['status'],
            _count: { id: true },
        }),
        prisma.job.groupBy({
            by: ['type'],
            _count: { id: true },
        }),
        prisma.job.count(),
    ])

    const jobStats: JobStats = {
        total: jobCount,
        byStatus: Object.fromEntries(jobStatusStats.map(s => [s.status, s._count.id])),
        byType: Object.fromEntries(jobTypeStats.map(s => [s.type, s._count.id])),
    }

    // Step statistics using groupBy
    const [stepStatusStats, stepTypeStats, stepCount, stepDurationAgg] = await Promise.all([
        prisma.step.groupBy({
            by: ['status'],
            _count: { id: true },
        }),
        prisma.step.groupBy({
            by: ['type'],
            _count: { id: true },
        }),
        prisma.step.count(),
        // Calculate average duration for completed steps
        prisma.step.aggregate({
            where: {
                startedAt: { not: null },
                completedAt: { not: null },
            },
            _count: { id: true },
        }),
    ])

    // Calculate average duration (need raw query for date diff, fallback to sample)
    let avgDurationMs: number | null = null
    if (stepDurationAgg._count.id > 0) {
        const sampleSteps = await prisma.step.findMany({
            where: {
                startedAt: { not: null },
                completedAt: { not: null },
            },
            select: { startedAt: true, completedAt: true },
            take: 100,
            orderBy: { completedAt: 'desc' },
        })
        if (sampleSteps.length > 0) {
            const totalDuration = sampleSteps.reduce((sum, s) => {
                return sum + (s.completedAt!.getTime() - s.startedAt!.getTime())
            }, 0)
            avgDurationMs = Math.round(totalDuration / sampleSteps.length)
        }
    }

    const stepStats: StepStats = {
        total: stepCount,
        byStatus: Object.fromEntries(stepStatusStats.map(s => [s.status, s._count.id])),
        byType: Object.fromEntries(stepTypeStats.map(s => [s.type, s._count.id])),
        avgDurationMs,
    }

    // Recent failures (last 10)
    const failedSteps = await prisma.step.findMany({
        where: { status: "FAILED" },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
            id: true,
            jobId: true,
            type: true,
            status: true,
            error: true,
            createdAt: true
        }
    })

    const recentFailures: RecentFailure[] = failedSteps.map(step => ({
        id: step.id,
        jobId: step.jobId,
        type: step.type,
        status: step.status,
        error: step.error ? JSON.stringify(step.error).slice(0, 200) : null,
        createdAt: step.createdAt.toISOString()
    }))

    // Ingest job summary using groupBy
    const ingestStatusStats = await prisma.ingestJob.groupBy({
        by: ['status'],
        _count: { id: true },
    })
    const ingestStatsMap = Object.fromEntries(ingestStatusStats.map(s => [s.status, s._count.id]))
    const ingestStats = {
        total: Object.values(ingestStatsMap).reduce((a, b) => a + b, 0),
        succeeded: ingestStatsMap['DONE'] || 0,
        failed: ingestStatsMap['PARTIAL_FAILED'] || 0,
        running: (ingestStatsMap['RUNNING'] || 0) + (ingestStatsMap['QUEUED'] || 0),
    }

    // Content item summary using groupBy
    const [captureStatusStats, rewriteStatusStats, publishStatusStats, contentCount] = await Promise.all([
        prisma.contentItem.groupBy({ by: ['captureStatus'], _count: { id: true } }),
        prisma.contentItem.groupBy({ by: ['rewriteStatus'], _count: { id: true } }),
        prisma.contentItem.groupBy({ by: ['publishStatus'], _count: { id: true } }),
        prisma.contentItem.count(),
    ])
    const captureMap = Object.fromEntries(captureStatusStats.map(s => [s.captureStatus, s._count.id]))
    const rewriteMap = Object.fromEntries(rewriteStatusStats.map(s => [s.rewriteStatus, s._count.id]))
    const publishMap = Object.fromEntries(publishStatusStats.map(s => [s.publishStatus, s._count.id]))

    const contentStats = {
        total: contentCount,
        byStatus: {
            READY: captureMap['READY'] || 0,
            FAILED: captureMap['FAILED'] || 0,
            REWRITTEN: rewriteMap['APPROVED'] || 0,
            PUBLISHED: publishMap['PUBLISHED'] || 0,
        }
    }

    return NextResponse.json({
        jobs: jobStats,
        steps: stepStats,
        recentFailures,
        ingestJobs: ingestStats,
        contentItems: contentStats,
        lastUpdated: new Date().toISOString()
    })
}
