import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/dashboard/stats - 获取仪表盘统计数据
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get('workspaceId')

        // 基础查询条件
        const whereClause = workspaceId ? { workspaceId } : {}

        // 并行获取所有统计数据
        const [
            totalInPool,
            pendingRewrite,
            publishedCount,
            queuedCount,
            recentActivity,
            thisWeekPublished
        ] = await Promise.all([
            // 素材池总数
            prisma.contentItem.count({ where: whereClause }),

            // 待改写数量 (NONE 或 REWORK 状态)
            prisma.contentItem.count({
                where: {
                    ...whereClause,
                    rewriteStatus: { in: ['NONE', 'REWORK'] }
                }
            }),

            // 已发布数量
            prisma.contentItem.count({
                where: {
                    ...whereClause,
                    publishStatus: 'PUBLISHED'
                }
            }),

            // 排队中数量 (Ingest jobs queued/running)
            prisma.ingestJob.count({
                where: {
                    ...whereClause,
                    status: { in: ['QUEUED', 'RUNNING'] }
                }
            }),

            // 最近活动
            prisma.auditLog.findMany({
                where: whereClause,
                orderBy: { createdAt: 'desc' },
                take: 10,
                select: {
                    id: true,
                    action: true,
                    details: true,
                    createdAt: true
                }
            }),

            // 本周发布数
            prisma.contentItem.count({
                where: {
                    ...whereClause,
                    publishStatus: 'PUBLISHED',
                    updatedAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ])

        // 格式化最近活动
        const activities = recentActivity.map(log => {
            const details = log.details as Record<string, unknown>
            let message = ''

            switch (log.action) {
                case 'INGEST_CREATED':
                    message = `Started ingest job with ${details.urlCount || 0} URLs`
                    break
                case 'INGEST_COMPLETED':
                    message = `Completed ingest: ${details.succeeded || 0} succeeded`
                    break
                case 'INGEST_FAILED':
                    message = `Ingest failed: ${details.error || 'Unknown error'}`
                    break
                case 'REWRITE_CREATED':
                    message = `Created rewrite batch`
                    break
                case 'REWRITE_GENERATED':
                    message = `Generated rewrite version`
                    break
                case 'REWRITE_APPROVED':
                    message = `Approved rewrite`
                    break
                case 'PUBLISH_QUEUED':
                    message = `Queued for publishing`
                    break
                case 'PUBLISH_SUCCEEDED':
                    message = `Successfully published`
                    break
                case 'PUBLISH_FAILED':
                    message = `Publish failed: ${details.error || 'Unknown error'}`
                    break
                default:
                    message = log.action.replace(/_/g, ' ').toLowerCase()
            }

            // 计算相对时间
            const now = new Date()
            const diff = now.getTime() - new Date(log.createdAt).getTime()
            const minutes = Math.floor(diff / 60000)
            const hours = Math.floor(diff / 3600000)
            const days = Math.floor(diff / 86400000)

            let timeAgo = ''
            if (minutes < 1) timeAgo = 'just now'
            else if (minutes < 60) timeAgo = `${minutes}m ago`
            else if (hours < 24) timeAgo = `${hours}h ago`
            else timeAgo = `${days}d ago`

            return {
                id: log.id,
                message,
                time: timeAgo,
                status: log.action.includes('FAILED') ? 'error' : 'success'
            }
        })

        return NextResponse.json({
            stats: {
                queued: queuedCount,
                inPool: totalInPool,
                pendingRewrite,
                published: publishedCount,
                thisWeekPublished
            },
            recentActivity: activities
        })
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
        return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
    }
}
