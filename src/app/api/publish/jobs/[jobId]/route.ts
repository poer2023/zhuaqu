import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/publish/jobs/[jobId] - 获取发布任务详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        const job = await prisma.publishJob.findUnique({
            where: { id: jobId },
            include: {
                rewriteVersion: {
                    include: {
                        contentItem: true
                    }
                },
                xAccount: {
                    select: { id: true, xUsername: true, xDisplayName: true }
                },
                publishResults: true,
            }
        })

        if (!job) {
            return NextResponse.json(
                { error: "Publish job not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ job })
    } catch (error) {
        console.error("Failed to fetch publish job:", error)
        return NextResponse.json(
            { error: "Failed to fetch publish job" },
            { status: 500 }
        )
    }
}

// PATCH /api/publish/jobs/[jobId] - 更新发布任务（取消、重试）
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params
        const body = await request.json()
        const { action } = body

        const job = await prisma.publishJob.findUnique({
            where: { id: jobId },
            include: { rewriteVersion: { include: { contentItem: true } } }
        })

        if (!job) {
            return NextResponse.json(
                { error: "Publish job not found" },
                { status: 404 }
            )
        }

        switch (action) {
            case "cancel":
                if (job.status === "QUEUED") {
                    const now = new Date()
                    await prisma.publishJob.update({
                        where: { id: jobId },
                        data: { status: "NOT_PUBLISHED" }
                    })

                    // 恢复内容项状态
                    await prisma.contentItem.update({
                        where: { id: job.rewriteVersion.contentItemId },
                        data: { publishStatus: "NOT_PUBLISHED" }
                    })

                    if (job.jobId) {
                        await prisma.job.updateMany({
                            where: { id: job.jobId },
                            data: { status: "CANCELED" }
                        })
                        await prisma.step.updateMany({
                            where: { jobId: job.jobId, type: "PUBLISH" },
                            data: { status: "SKIPPED", completedAt: now }
                        })
                    }

                    return NextResponse.json({ success: true, message: "Job cancelled" })
                }
                return NextResponse.json(
                    { error: "Can only cancel queued jobs" },
                    { status: 400 }
                )

            case "retry":
                if (job.status === "FAILED") {
                    const now = new Date()
                    await prisma.publishJob.update({
                        where: { id: jobId },
                        data: {
                            status: "QUEUED",
                            retryCount: { increment: 1 },
                            lastError: null,
                        }
                    })

                    await prisma.contentItem.update({
                        where: { id: job.rewriteVersion.contentItemId },
                        data: { publishStatus: "QUEUED" }
                    })

                    if (job.jobId) {
                        await prisma.job.updateMany({
                            where: { id: job.jobId, status: { in: ["FAILED", "DONE"] } },
                            data: { status: "PENDING" }
                        })
                        await prisma.step.updateMany({
                            where: { jobId: job.jobId, type: "PUBLISH" },
                            data: {
                                status: "QUEUED",
                                availableAt: now,
                                startedAt: null,
                                completedAt: null,
                                error: {},
                                outputRef: {},
                            }
                        })
                    }

                    return NextResponse.json({ success: true, message: "Job retried" })
                }
                return NextResponse.json(
                    { error: "Can only retry failed jobs" },
                    { status: 400 }
                )

            default:
                return NextResponse.json(
                    { error: "Unknown action" },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error("Failed to update publish job:", error)
        return NextResponse.json(
            { error: "Failed to update publish job" },
            { status: 500 }
        )
    }
}

// DELETE /api/publish/jobs/[jobId] - 删除发布任务
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        await prisma.publishJob.delete({
            where: { id: jobId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete publish job:", error)
        return NextResponse.json(
            { error: "Failed to delete publish job" },
            { status: 500 }
        )
    }
}
