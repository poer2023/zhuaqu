import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

// Define type locally to avoid Prisma enum import issues
type SyncJobStatusType = 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'

interface RouteParams {
    params: Promise<{ jobId: string }>
}

async function updateOrchestrationForSyncJob(args: {
    tx: Prisma.TransactionClient
    orchestrationJobId: string | null
    action:
        | 'start'
        | 'pause'
        | 'resume'
        | 'cancel'
        | 'complete'
        | 'fail'
    error?: unknown
}) {
    const { tx, orchestrationJobId, action } = args
    if (!orchestrationJobId) return

    const now = new Date()

    const setJob = async (status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'FAILED' | 'DONE' | 'CANCELED') => {
        await tx.job.updateMany({ where: { id: orchestrationJobId }, data: { status } })
    }

    switch (action) {
        case 'start':
        case 'resume':
            // 控制面只负责把任务恢复到可领取状态，RUNNING 由 worker claimNextStep 设置
            await setJob('PENDING')
            await tx.step.updateMany({
                where: { jobId: orchestrationJobId, type: 'CAPTURE' },
                data: {
                    status: 'QUEUED',
                    availableAt: now,
                    startedAt: null,
                    completedAt: null,
                    error: {},
                    outputRef: {},
                }
            })
            return
        case 'pause':
            await setJob('PAUSED')
            await tx.step.updateMany({
                where: { jobId: orchestrationJobId, type: 'CAPTURE', status: 'RUNNING' },
                data: {
                    status: 'QUEUED',
                    availableAt: now,
                }
            })
            return
        case 'cancel':
            await setJob('CANCELED')
            await tx.step.updateMany({
                where: { jobId: orchestrationJobId, type: 'CAPTURE', status: { in: ['QUEUED', 'RUNNING'] } },
                data: {
                    status: 'SKIPPED',
                    completedAt: now,
                }
            })
            return
        case 'complete':
            await setJob('DONE')
            await tx.step.updateMany({
                where: { jobId: orchestrationJobId, type: 'CAPTURE', status: { in: ['QUEUED', 'RUNNING'] } },
                data: {
                    status: 'SUCCEEDED',
                    completedAt: now,
                    error: {},
                }
            })
            return
        case 'fail':
            await setJob('FAILED')
            await tx.step.updateMany({
                where: { jobId: orchestrationJobId, type: 'CAPTURE', status: { in: ['QUEUED', 'RUNNING'] } },
                data: {
                    status: 'FAILED',
                    completedAt: now,
                    error: {
                        code: 'SYNC_FAILED',
                        message: typeof args.error === 'string' ? args.error : 'Sync job failed',
                        at: now.toISOString(),
                    } as Prisma.InputJsonValue,
                }
            })
            return
        default:
            return
    }
}

// GET /api/sync/jobs/:jobId - 获取任务详情
export async function GET(request: NextRequest, { params }: RouteParams) {
    try {
        const { jobId } = await params

        const job = await prisma.syncJob.findUnique({
            where: { id: jobId },
            include: {
                pool: {
                    select: { id: true, name: true }
                },
                workspace: {
                    select: { id: true, name: true }
                }
            }
        })

        if (!job) {
            return NextResponse.json({ error: 'Sync job not found' }, { status: 404 })
        }

        return NextResponse.json(job)
    } catch (error) {
        console.error('Failed to fetch sync job:', error)
        return NextResponse.json({ error: 'Failed to fetch sync job' }, { status: 500 })
    }
}

// PATCH /api/sync/jobs/:jobId - 更新任务状态 (暂停/继续/取消)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
    try {
        const { jobId } = await params
        const body = await request.json()
        const { action, progress, items } = body

        const job = await prisma.syncJob.findUnique({
            where: { id: jobId }
        })

        if (!job) {
            return NextResponse.json({ error: 'Sync job not found' }, { status: 404 })
        }

        let updateData: Record<string, unknown> = {}

        switch (action) {
            case 'start':
                if (job.status !== 'PENDING' && job.status !== 'PAUSED') {
                    return NextResponse.json({ error: 'Job cannot be started' }, { status: 400 })
                }
                updateData = {
                    status: 'PENDING' as SyncJobStatusType,
                }
                break

            case 'pause':
                if (job.status !== 'RUNNING') {
                    return NextResponse.json({ error: 'Only running jobs can be paused' }, { status: 400 })
                }
                updateData = { status: 'PAUSED' as SyncJobStatusType }
                break

            case 'resume':
                if (job.status !== 'PAUSED') {
                    return NextResponse.json({ error: 'Only paused jobs can be resumed' }, { status: 400 })
                }
                updateData = { status: 'PENDING' as SyncJobStatusType }
                break

            case 'cancel':
                if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
                    return NextResponse.json({ error: 'Job already finished' }, { status: 400 })
                }
                updateData = {
                    status: 'CANCELLED' as SyncJobStatusType,
                    completedAt: new Date()
                }
                break

            case 'complete':
                updateData = {
                    status: 'COMPLETED' as SyncJobStatusType,
                    completedAt: new Date()
                }
                break

            case 'fail':
                updateData = {
                    status: 'FAILED' as SyncJobStatusType,
                    error: body.error || 'Unknown error',
                    completedAt: new Date()
                }
                break

            case 'update_progress':
                // 更新进度和游标
                if (progress) {
                    const currentProgress = job.progress as Record<string, number>
                    updateData.progress = {
                        ...currentProgress,
                        ...progress
                    }
                }
                if (body.lastCursor) {
                    updateData.lastCursor = body.lastCursor
                }
                if (typeof body.totalItems === 'number') {
                    updateData.totalItems = body.totalItems
                }
                if (typeof body.successCount === 'number') {
                    updateData.successCount = body.successCount
                }
                if (typeof body.failCount === 'number') {
                    updateData.failCount = body.failCount
                }
                if (typeof body.dedupedCount === 'number') {
                    updateData.dedupedCount = body.dedupedCount
                }
                break

            case 'add_items':
                // 将采集到的 items 批量创建为 ContentItem
                if (items && Array.isArray(items) && items.length > 0) {
                    const workspace = await prisma.workspace.findUnique({
                        where: { id: job.workspaceId }
                    })
                    if (!workspace) {
                        return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })
                    }

                    let ingested = 0
                    let deduped = 0
                    let failed = 0

                    for (const item of items) {
                        try {
                            // 检查去重
                            const existing = await prisma.contentItem.findFirst({
                                where: {
                                    workspaceId: job.workspaceId,
                                    sourceId: item.sourceId
                                }
                            })

                            if (existing) {
                                deduped++
                                continue
                            }

                            await prisma.contentItem.create({
                                data: {
                                    workspaceId: job.workspaceId,
                                    poolId: job.poolId,
                                    jobId: job.jobId ?? null,
                                    sourceId: item.sourceId,
                                    sourceUrl: item.sourceUrl,
                                    authorHandle: item.authorHandle || 'unknown',
                                    textOriginal: item.textOriginal || '',
                                    lang: item.lang,
                                    rawJson: item.rawJson || {},
                                    captureStatus: 'READY',
                                    rewriteStatus: 'NONE',
                                    publishStatus: 'NOT_PUBLISHED'
                                }
                            })
                            ingested++
                        } catch {
                            failed++
                        }
                    }

                    // 更新进度
                    const currentProgress = job.progress as Record<string, number>
                    updateData.progress = {
                        discovered: (currentProgress.discovered || 0) + items.length,
                        submitted: (currentProgress.submitted || 0) + items.length,
                        ingested: (currentProgress.ingested || 0) + ingested,
                        failed: (currentProgress.failed || 0) + failed,
                        deduped: (currentProgress.deduped || 0) + deduped
                    }
                    updateData.successCount = (job.successCount || 0) + ingested
                    updateData.failCount = (job.failCount || 0) + failed
                    updateData.dedupedCount = (job.dedupedCount || 0) + deduped
                    updateData.totalItems = (job.totalItems || 0) + items.length
                }
                break

            default:
                return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
        }

        const updatedJob = await prisma.$transaction(async (tx) => {
            const updated = await tx.syncJob.update({
                where: { id: jobId },
                data: updateData,
                include: {
                    pool: {
                        select: { id: true, name: true }
                    }
                }
            })

            if (action === 'start' || action === 'pause' || action === 'resume' || action === 'cancel' || action === 'complete' || action === 'fail') {
                await updateOrchestrationForSyncJob({
                    tx,
                    orchestrationJobId: updated.jobId ?? null,
                    action,
                    error: body.error,
                })
            }

            return updated
        })

        return NextResponse.json(updatedJob)
    } catch (error) {
        console.error('Failed to update sync job:', error)
        return NextResponse.json({ error: 'Failed to update sync job' }, { status: 500 })
    }
}

// DELETE /api/sync/jobs/:jobId - 删除任务
export async function DELETE(request: NextRequest, { params }: RouteParams) {
    try {
        const { jobId } = await params

        const job = await prisma.syncJob.findUnique({
            where: { id: jobId }
        })

        if (!job) {
            return NextResponse.json({ error: 'Sync job not found' }, { status: 404 })
        }

        if (job.status === 'RUNNING') {
            return NextResponse.json({ error: 'Cannot delete a running job' }, { status: 400 })
        }

        await prisma.syncJob.delete({
            where: { id: jobId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error('Failed to delete sync job:', error)
        return NextResponse.json({ error: 'Failed to delete sync job' }, { status: 500 })
    }
}
