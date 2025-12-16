import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createJobWithSteps } from '@/server/orchestrator'

// Define types locally to avoid Prisma enum import issues
type SyncJobStatusType = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
type SyncSourceType = 'LIKES' | 'BOOKMARKS' | 'TIMELINE'

const VALID_SOURCES: SyncSourceType[] = ['LIKES', 'BOOKMARKS', 'TIMELINE']

// GET /api/sync/jobs - 获取同步任务列表
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')
        const status = searchParams.get('status') as SyncJobStatusType | null
        const limit = parseInt(searchParams.get('limit') || '20')

        if (!workspaceId) {
            return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
        }

        const where: Record<string, unknown> = { workspaceId }
        if (status) {
            where.status = status
        }

        const jobs = await prisma.syncJob.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            include: {
                pool: {
                    select: { id: true, name: true }
                }
            }
        })

        return NextResponse.json(jobs)
    } catch (error) {
        console.error('Failed to fetch sync jobs:', error)
        return NextResponse.json({ error: 'Failed to fetch sync jobs' }, { status: 500 })
    }
}

// POST /api/sync/jobs - 创建同步任务
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, poolId, source, options = {} } = body

        if (!workspaceId || !poolId || !source) {
            return NextResponse.json(
                { error: 'workspaceId, poolId, and source are required' },
                { status: 400 }
            )
        }

        // 验证 source
        if (!VALID_SOURCES.includes(source)) {
            return NextResponse.json(
                { error: 'Invalid source. Must be LIKES, BOOKMARKS, or TIMELINE' },
                { status: 400 }
            )
        }

        // 检查是否有正在运行的同步任务
        const existingJob = await prisma.syncJob.findFirst({
            where: {
                workspaceId,
                source,
                status: { in: ['PENDING', 'RUNNING'] }
            }
        })

        if (existingJob) {
            return NextResponse.json(
                { error: 'A sync job for this source is already running', existingJobId: existingJob.id },
                { status: 409 }
            )
        }

        const resolvedOptions = {
            limit: options.limit || 100,
            mediaOnly: options.mediaOnly || false,
            excludeAuthors: options.excludeAuthors || [],
            includeReplies: options.includeReplies || false,
        }

        const jobType = source === 'LIKES'
            ? 'SYNC_LIKES'
            : source === 'BOOKMARKS'
                ? 'SYNC_BOOKMARKS'
                : 'SYNC_TIMELINE'

        const job = await prisma.$transaction(async (tx) => {
            const syncJob = await tx.syncJob.create({
                data: {
                    workspaceId,
                    poolId,
                    source,
                    status: 'PENDING',
                    options: resolvedOptions,
                    progress: {
                        discovered: 0,
                        submitted: 0,
                        ingested: 0,
                        failed: 0,
                        deduped: 0
                    }
                },
                include: {
                    pool: {
                        select: { id: true, name: true }
                    }
                }
            })

            const { job: orchestrationJob } = await createJobWithSteps(
                {
                    type: jobType,
                    workspaceId,
                    poolId,
                    config: {
                        syncJobId: syncJob.id,
                        source,
                        options: resolvedOptions,
                    },
                    steps: [
                        {
                            type: 'CAPTURE',
                            maxAttempts: 3,
                            inputRef: { syncJobId: syncJob.id },
                        }
                    ]
                },
                tx
            )

            return tx.syncJob.update({
                where: { id: syncJob.id },
                data: { jobId: orchestrationJob.id },
                include: {
                    pool: {
                        select: { id: true, name: true }
                    }
                }
            })
        })

        return NextResponse.json(job, { status: 201 })
    } catch (error) {
        console.error('Failed to create sync job:', error)
        return NextResponse.json({ error: 'Failed to create sync job' }, { status: 500 })
    }
}
