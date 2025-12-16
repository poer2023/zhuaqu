import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createJobWithSteps } from "@/server/orchestrator"
import { getLoggedInUser } from "@/server/publish/xPublisher"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

async function ensureBrowserXAccount(workspaceId: string): Promise<{ id: string; xUsername: string; xDisplayName: string | null }> {
    // 查找默认账号或第一个活跃账号
    const existing = await prisma.xAccount.findFirst({
        where: { workspaceId, isActive: true },
        orderBy: [{ isDefault: 'desc' }, { lastUsedAt: 'desc' }]
    })
    if (existing) return { id: existing.id, xUsername: existing.xUsername, xDisplayName: existing.xDisplayName ?? null }

    const user = await getLoggedInUser()
    if (!user.isLoggedIn || !user.username) {
        throw new Error("No browser session connected (Settings → Integrations)")
    }

    const created = await prisma.xAccount.create({
        data: {
            workspaceId,
            xUserId: user.username,
            xUsername: user.username,
            xDisplayName: user.displayName ?? null,
            xAvatar: null,
            accessToken: "browser_session",
            refreshToken: null,
            tokenExpiry: null,
            isActive: true,
            lastUsedAt: new Date(),
        },
        select: { id: true, xUsername: true, xDisplayName: true },
    })
    return { id: created.id, xUsername: created.xUsername, xDisplayName: created.xDisplayName ?? null }
}

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

        const xAccount = await ensureBrowserXAccount(workspaceId)

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
        const scheduledKey = scheduledAtDate ? scheduledAtDate.toISOString() : "immediate"
        const resolvedMode = mode === "thread" ? "thread" : "single"

        const jobs = await Promise.all(
            versions.map(async (version) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                return prisma.$transaction(async (tx: any) => {
                    const idempotencyKey = `publish:${version.id}:${xAccount.id}:${scheduledKey}`

                    const { job: orchestrationJob } = await createJobWithSteps(
                        {
                            type: "PUBLISH",
                            workspaceId,
                            poolId: version.contentItem.poolId,
                            idempotencyKey,
                            config: {
                                rewriteVersionId: version.id,
                                xAccountId: xAccount.id,
                                mode: resolvedMode,
                                scheduledAt: scheduledAtDate?.toISOString() ?? null,
                            } as JsonValue,
                            steps: [
                                {
                                    type: "PUBLISH",
                                    maxAttempts: resolvedMode === "thread" ? 1 : 3,
                                    inputRef: { rewriteVersionId: version.id } as JsonValue,
                                    availableAt: scheduledAtDate ?? new Date(),
                                },
                            ],
                        },
                        tx
                    )

                    const existing = await tx.publishJob.findUnique({ where: { jobId: orchestrationJob.id } })
                    const publishJob = existing
                        ? existing
                        : await tx.publishJob.create({
                            data: {
                                workspaceId,
                                xAccountId: xAccount.id,
                                rewriteVersionId: version.id,
                                mode: resolvedMode,
                                scheduledAt: scheduledAtDate,
                                status: "QUEUED",
                                jobId: orchestrationJob.id,
                            }
                        })

                    await tx.step.updateMany({
                        where: { jobId: orchestrationJob.id, type: "PUBLISH" },
                        data: {
                            inputRef: { publishJobId: publishJob.id, rewriteVersionId: version.id } as JsonValue,
                            availableAt: scheduledAtDate ?? new Date(),
                        }
                    })

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
                                orchestrationJobId: orchestrationJob.id,
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
