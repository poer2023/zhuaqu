import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/pools/items - 获取素材池内容条目（分页 + 筛选）
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)

        // 筛选参数
        const workspaceId = searchParams.get("workspaceId")
        const poolId = searchParams.get("poolId")
        const q = searchParams.get("q") // 搜索关键词
        const tags = searchParams.get("tags")?.split(",").filter(Boolean)
        const author = searchParams.get("author")
        const captureStatus = searchParams.get("captureStatus")
        const rewriteStatus = searchParams.get("rewriteStatus")
        const publishStatus = searchParams.get("publishStatus")
        const mediaType = searchParams.get("mediaType")

        // 分页
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "20")
        const skip = (page - 1) * limit

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
                where.media = { path: "$[*].type", string_contains: "image" }
            } else if (mediaType === "video") {
                where.media = { path: "$[*].type", string_contains: "video" }
            }
        }

        // 查询
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
                skip,
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

        return NextResponse.json({
            items: formattedItems,
            pageInfo: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
                hasMore: skip + items.length < total,
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
                const { tagIds } = data
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

                return NextResponse.json({ success: true, affected: itemIds.length })
            }

            case "move": {
                const { poolId } = data
                if (!poolId) {
                    return NextResponse.json({ error: "poolId required" }, { status: 400 })
                }

                await prisma.contentItem.updateMany({
                    where: { id: { in: itemIds } },
                    data: { poolId }
                })

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
                await prisma.contentItem.deleteMany({
                    where: { id: { in: itemIds } }
                })

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
