import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createBatchAuditLogs, createBatchItemAuditEntries } from "@/lib/audit"

// GET /api/pools/items - 获取素材池内容条目（支持游标分页 + 筛选）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        // 筛选参数
        const workspaceId = searchParams.get("workspaceId")
        const poolId = searchParams.get("poolId")
        const q = searchParams.get("q") || searchParams.get("search") // 搜索关键词
        const tags = searchParams.get("tags")?.split(",").filter(Boolean)
        const author = searchParams.get("author")
        const captureStatus = searchParams.get("captureStatus")
        const rewriteStatus = searchParams.get("rewriteStatus")
        const publishStatus = searchParams.get("publishStatus")
        const mediaType = searchParams.get("mediaType")
        const statusFilter = searchParams.get("statusFilter")

        // 分页 - 支持 cursor 和 page 两种模式
        const cursor = searchParams.get("cursor")
        const MAX_LIMIT = 100
        const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(searchParams.get("limit") || "20")))

        // 传统分页 (向后兼容)
        const page = Math.max(1, parseInt(searchParams.get("page") || "1"))
        const skip = cursor ? 1 : (page - 1) * limit // cursor 模式下 skip=1 跳过 cursor 本身

        // 构建查询条件
        const where: Record<string, unknown> = {
            isArchived: false,
        }

        if (workspaceId) where.workspaceId = workspaceId
        if (poolId) where.poolId = poolId
        if (author) where.authorHandle = { contains: author, mode: "insensitive" }
        if (captureStatus) where.captureStatus = captureStatus
        if (rewriteStatus) where.rewriteStatus = rewriteStatus
        if (publishStatus) where.publishStatus = publishStatus

        // 状态筛选快捷方式
        if (statusFilter) {
            switch (statusFilter) {
                case "pending":
                    where.captureStatus = "QUEUED"
                    break
                case "rewrite_pending":
                    where.rewriteStatus = { in: ["NONE", "REWORK"] }
                    break
                case "publish_pending":
                    where.rewriteStatus = "APPROVED"
                    where.publishStatus = "NOT_PUBLISHED"
                    break
                case "published":
                    where.publishStatus = "PUBLISHED"
                    break
            }
        }

        // 搜索
        if (q) {
            where.OR = [
                { textOriginal: { contains: q, mode: "insensitive" } },
                { authorHandle: { contains: q, mode: "insensitive" } },
                { authorName: { contains: q, mode: "insensitive" } },
                { notes: { contains: q, mode: "insensitive" } },
            ]
        }

        // 标签筛选
        if (tags && tags.length > 0) {
            where.tags = {
                some: {
                    tagId: { in: tags }
                }
            }
        }

        // 媒体类型筛选
        if (mediaType) {
            if (mediaType === "none") {
                where.media = { equals: [] }
            } else if (mediaType === "image") {
                where.media = { array_contains: [{ type: "image" }] }
            } else if (mediaType === "video") {
                where.media = { array_contains: [{ type: "video" }] }
            }
        }

        // 查询 - 支持 cursor 分页
        const [items, total] = await Promise.all([
            prisma.contentItem.findMany({
                where,
                include: {
                    pool: { select: { id: true, name: true } },
                    tags: {
                        include: {
                            tag: true
                        }
                    },
                    rewriteVersions: {
                        where: { status: "APPROVED" },
                        take: 1,
                        orderBy: { version: "desc" }
                    },
                    _count: {
                        select: { rewriteVersions: true }
                    }
                },
                ...(cursor ? { cursor: { id: cursor }, skip: 1 } : { skip }),
                take: limit,
                orderBy: { createdAt: "desc" }
            }),
            prisma.contentItem.count({ where })
        ])

        // 格式化返回数据
        const formattedItems = items.map(item => ({
            ...item,
            tags: item.tags.map(t => t.tag),
            hasApprovedRewrite: item.rewriteVersions.length > 0,
            approvedRewriteVersionId: item.rewriteVersions[0]?.id,
            rewriteCount: item._count.rewriteVersions,
        }))

        // 计算下一个 cursor
        const nextCursor = items.length === limit ? items[items.length - 1]?.id : undefined
        const hasMore = cursor
            ? items.length === limit
            : (skip + items.length) < total

        return NextResponse.json({
            items: formattedItems,
            total,
            hasMore,
            nextCursor,
            // 保留传统分页信息 (向后兼容)
            pageInfo: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore,
            }
        })
    } catch (error) {
        console.error("Failed to fetch items:", error)
        return NextResponse.json(
            { error: "Failed to fetch items" },
            { status: 500 }
        )
    }
}

// POST /api/pools/items - 批量操作
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, itemIds, data } = body

        if (!action || !itemIds || !Array.isArray(itemIds)) {
            return NextResponse.json(
                { error: "Action and itemIds are required" },
                { status: 400 }
            )
        }

        switch (action) {
            case "addTags": {
                const { tagIds, workspaceId } = data
                if (!tagIds || !Array.isArray(tagIds)) {
                    return NextResponse.json({ error: "tagIds required" }, { status: 400 })
                }

                // 批量添加标签
                const createData = itemIds.flatMap(itemId =>
                    tagIds.map(tagId => ({
                        contentItemId: itemId,
                        tagId,
                    }))
                )

                await prisma.contentItemTag.createMany({
                    data: createData,
                    skipDuplicates: true,
                })

                // 审计日志
                if (workspaceId) {
                    const auditEntries = createBatchItemAuditEntries(
                        workspaceId,
                        itemIds,
                        "ITEM_TAGGED",
                        { tagIds, tagCount: tagIds.length },
                        "owner"
                    )
                    await createBatchAuditLogs(auditEntries)
                }

                return NextResponse.json({ success: true, affected: itemIds.length })
            }

            case "move": {
                const { poolId, workspaceId } = data
                if (!poolId) {
                    return NextResponse.json({ error: "poolId required" }, { status: 400 })
                }

                await prisma.contentItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: { poolId }
                })

                // 审计日志
                if (workspaceId) {
                    const auditEntries = createBatchItemAuditEntries(
                        workspaceId,
                        itemIds,
                        "ITEM_MOVED",
                        { targetPoolId: poolId },
                        "owner"
                    )
                    await createBatchAuditLogs(auditEntries)
                }

                return NextResponse.json({ success: true, affected: itemIds.length })
            }

            case "archive": {
                await prisma.contentItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: { isArchived: true }
                })

                return NextResponse.json({ success: true, affected: itemIds.length })
            }

            case "delete": {
                const { workspaceId } = data || {}

                // 先获取要删除的内容项信息用于审计
                const itemsToDelete = workspaceId
                    ? await prisma.contentItem.findMany({
                        where: { id: { in: itemIds } },
                        select: { id: true, workspaceId: true, sourceUrl: true },
                    })
                    : []

                await prisma.contentItem.deleteMany({
                    where: { id: { in: itemIds } }
                })

                // 审计日志
                if (workspaceId && itemsToDelete.length > 0) {
                    const auditEntries = itemsToDelete.map((item) => ({
                        workspaceId: item.workspaceId,
                        contentItemId: item.id,
                        action: "ITEM_DELETED" as const,
                        details: { sourceUrl: item.sourceUrl },
                        actor: "owner",
                    }))
                    await createBatchAuditLogs(auditEntries)
                }

                return NextResponse.json({ success: true, affected: itemIds.length })
            }

            default:
                return NextResponse.json({ error: "Unknown action" }, { status: 400 })
        }
    } catch (error) {
        console.error("Failed to process batch action:", error)
        return NextResponse.json(
            { error: "Failed to process batch action" },
            { status: 500 }
        )
    }
}
