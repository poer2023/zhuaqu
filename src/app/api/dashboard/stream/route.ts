import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"

export const dynamic = "force-dynamic"
export const runtime = "nodejs"

/**
 * SSE endpoint for real-time dashboard updates
 * Replaces client-side polling with server-sent events
 */
export async function GET(request: NextRequest) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        async start(controller) {
            const sendEvent = (data: unknown) => {
                const message = `data: ${JSON.stringify(data)}\n\n`
                controller.enqueue(encoder.encode(message))
            }

            const fetchDashboardData = async () => {
                try {
                    // Job statistics
                    const [jobStatusStats, jobTypeStats, jobCount] = await Promise.all([
                        prisma.job.groupBy({ by: ['status'], _count: { id: true } }),
                        prisma.job.groupBy({ by: ['type'], _count: { id: true } }),
                        prisma.job.count(),
                    ])

                    // Step statistics
                    const [stepStatusStats, stepTypeStats, stepCount] = await Promise.all([
                        prisma.step.groupBy({ by: ['status'], _count: { id: true } }),
                        prisma.step.groupBy({ by: ['type'], _count: { id: true } }),
                        prisma.step.count(),
                    ])

                    // Recent failures
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

                    // Content stats
                    const [publishStatusStats, contentCount] = await Promise.all([
                        prisma.contentItem.groupBy({ by: ['publishStatus'], _count: { id: true } }),
                        prisma.contentItem.count(),
                    ])

                    const publishMap = Object.fromEntries(publishStatusStats.map(s => [s.publishStatus, s._count.id]))

                    return {
                        jobs: {
                            total: jobCount,
                            byStatus: Object.fromEntries(jobStatusStats.map(s => [s.status, s._count.id])),
                            byType: Object.fromEntries(jobTypeStats.map(s => [s.type, s._count.id])),
                        },
                        steps: {
                            total: stepCount,
                            byStatus: Object.fromEntries(stepStatusStats.map(s => [s.status, s._count.id])),
                            byType: Object.fromEntries(stepTypeStats.map(s => [s.type, s._count.id])),
                        },
                        recentFailures: failedSteps.map(step => ({
                            id: step.id,
                            jobId: step.jobId,
                            type: step.type,
                            status: step.status,
                            error: step.error ? JSON.stringify(step.error).slice(0, 200) : null,
                            createdAt: step.createdAt.toISOString()
                        })),
                        contentItems: {
                            total: contentCount,
                            byStatus: { PUBLISHED: publishMap['PUBLISHED'] || 0 }
                        },
                        lastUpdated: new Date().toISOString()
                    }
                } catch (error) {
                    console.error("Dashboard SSE fetch error:", error)
                    return null
                }
            }

            // Send initial data
            const initialData = await fetchDashboardData()
            if (initialData) {
                sendEvent(initialData)
            }

            // Set up interval for updates (every 10 seconds)
            const interval = setInterval(async () => {
                const data = await fetchDashboardData()
                if (data) {
                    sendEvent(data)
                }
            }, 10000)

            // Handle client disconnect
            request.signal.addEventListener("abort", () => {
                clearInterval(interval)
                controller.close()
            })
        },
    })

    return new Response(stream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no", // Disable nginx buffering
        },
    })
}
