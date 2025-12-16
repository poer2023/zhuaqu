import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createJobWithSteps } from "@/server/orchestrator"

// GET /api/publish/jobs - 获取发布任务列表
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")
        const status = searchParams.get("status")
        const limit = parseInt(searchParams.get("limit") || "20")

        const jobs = await prisma.publishJob.findMany({
            where: {
                ...(workspaceId && { workspaceId }),
                ...(status && { status: status as "QUEUED" | "PUBLISHED" | "FAILED" | "NOT_PUBLISHED" }),
            },
            include: {
                rewriteVersion: {
                    include: {
                        contentItem: {
                            select: {
                                id: true,
                                sourceUrl: true,
                                authorHandle: true,
                                textOriginal: true,
                            }
                        }
                    }
                },
                xAccount: {
                    select: { id: true, xUsername: true, xDisplayName: true }
                },
                publishResults: true,
            },
            take: limit,
            orderBy: [
                { scheduledAt: "asc" },
                { createdAt: "desc" }
            ]
        })

        return NextResponse.json({ jobs })
    } catch (error) {
        console.error("Failed to fetch publish jobs:", error)
        return NextResponse.json(
            { error: "Failed to fetch publish jobs" },
            { status: 500 }
        )
    }
}

// POST /api/publish/jobs - 创建发布任务
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, rewriteVersionIds, mode, scheduledAt } = body

        if (!workspaceId || !rewriteVersionIds || !Array.isArray(rewriteVersionIds)) {
            return NextResponse.json(
                { error: "workspaceId and rewriteVersionIds are required" },
                { status: 400 }
            )
        }

        // 获取 X 账号
        const xAccount = await prisma.xAccount.findUnique({
            where: { workspaceId }
        })

        if (!xAccount) {
            return NextResponse.json(
                { error: "No X account connected to this workspace" },
                { status: 400 }
            )
        }

        // 验证改写版本必须是 APPROVED 状态
        const versions = await prisma.rewriteVersion.findMany({
            where: {
                id: { in: rewriteVersionIds },
                status: "APPROVED",
            },
            include: {
                contentItem: true
            }
        })

        if (versions.length === 0) {
            return NextResponse.json(
                { error: "No approved versions found" },
                { status: 400 }
            )
        }

        // 创建发布任务
        const scheduledAtDate = scheduledAt ? new Date(scheduledAt) : null

        const jobs = await Promise.all(
            versions.map(async (version) => {
                return prisma.$transaction(async (tx) => {
                    const existing = await tx.publishJob.findFirst({
                        where: {
                            workspaceId,
                            xAccountId: xAccount.id,
                            rewriteVersionId: version.id,
                            scheduledAt: scheduledAtDate,
                        }
                    })

                    const ensureOrchestration = async (publishJobId: string) => {
                        const { job: orchestrationJob } = await createJobWithSteps(
                            {
                                type: "PUBLISH",
                                workspaceId,
                                poolId: version.contentItem.poolId,
                                config: {
                                    publishJobId,
                                    rewriteVersionId: version.id,
                                    xAccountId: xAccount.id,
                                    mode: mode || "single",
                                    scheduledAt: scheduledAtDate?.toISOString() ?? null,
                                },
                                steps: [
                                    {
                                        type: "PUBLISH",
                                        maxAttempts: 3,
                                        inputRef: { publishJobId },
                                        availableAt: scheduledAtDate ?? new Date(),
                                    },
                                ],
                            },
                            tx
                        )

                        await tx.publishJob.update({
                            where: { id: publishJobId },
                            data: { jobId: orchestrationJob.id },
                        })

                        return orchestrationJob.id
                    }

                    if (existing) {
                        if (!existing.jobId) {
                            await ensureOrchestration(existing.id)
                        }
                        return (await tx.publishJob.findUnique({ where: { id: existing.id } })) ?? existing
                    }

                    const publishJob = await tx.publishJob.create({
                        data: {
                            workspaceId,
                            xAccountId: xAccount.id,
                            rewriteVersionId: version.id,
                            mode: mode || "single",
                            scheduledAt: scheduledAtDate,
                            status: "QUEUED",
                        }
                    })

                    const orchestrationJobId = await ensureOrchestration(publishJob.id)

                    // 更新内容项状态
                    await tx.contentItem.update({
                        where: { id: version.contentItemId },
                        data: { publishStatus: "QUEUED" }
                    })

                    // 记录审计日志
                    await tx.auditLog.create({
                        data: {
                            workspaceId,
                            contentItemId: version.contentItemId,
                            action: "PUBLISH_QUEUED",
                            details: {
                                jobId: publishJob.id,
                                orchestrationJobId,
                                mode,
                                scheduledAt,
                            },
                            actor: "owner",
                        }
                    })

                    return (await tx.publishJob.findUnique({ where: { id: publishJob.id } })) ?? publishJob
                })
            })
        )

        return NextResponse.json({ jobs }, { status: 201 })
    } catch (error) {
        console.error("Failed to create publish jobs:", error)
        return NextResponse.json(
            { error: "Failed to create publish jobs" },
            { status: 500 }
        )
    }
}
