import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/content-items/[itemId] - 获取单个内容条目详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    try {
        const { itemId } = await params

        const item = await prisma.contentItem.findUnique({
            where: { id: itemId },
            include: {
                pool: { select: { id: true, name: true } },
                tags: {
                    include: {
                        tag: true
                    }
                },
                rewriteVersions: {
                    orderBy: { version: "desc" },
                    take: 10,
                },
                publishResults: {
                    orderBy: { publishedAt: "desc" },
                    take: 20,
                },
                auditLogs: {
                    orderBy: { createdAt: "desc" },
                    take: 20,
                }
            }
        })

        if (!item) {
            return NextResponse.json(
                { error: "Content item not found" },
                { status: 404 }
            )
        }

        // Format response
        const formattedItem = {
            ...item,
            tags: item.tags.map(t => t.tag),
        }

        return NextResponse.json({ item: formattedItem })
    } catch (error) {
        console.error("Failed to fetch content item:", error)
        return NextResponse.json(
            { error: "Failed to fetch content item" },
            { status: 500 }
        )
    }
}

// PATCH /api/content-items/[itemId] - 更新内容条目
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    try {
        const { itemId } = await params
        const body = await request.json()

        const { notes, rewriteStatus, publishStatus, poolId, addTagIds, removeTagIds, addTagName } = body

        // 获取内容项以验证存在并获取工作区ID
        const existingItem = await prisma.contentItem.findUnique({
            where: { id: itemId },
            select: { id: true, workspaceId: true }
        })

        if (!existingItem) {
            return NextResponse.json({ error: "Content item not found" }, { status: 404 })
        }

        const updateData: Record<string, unknown> = {}
        if (notes !== undefined) updateData.notes = notes
        if (rewriteStatus !== undefined) updateData.rewriteStatus = rewriteStatus
        if (publishStatus !== undefined) updateData.publishStatus = publishStatus
        if (poolId !== undefined) updateData.poolId = poolId

        // 处理标签操作
        if (addTagIds && Array.isArray(addTagIds) && addTagIds.length > 0) {
            // 批量添加标签关联
            await prisma.contentItemTag.createMany({
                data: addTagIds.map((tagId: string) => ({
                    contentItemId: itemId,
                    tagId,
                })),
                skipDuplicates: true,
            })

            // 记录审计日志
            await prisma.auditLog.create({
                data: {
                    workspaceId: existingItem.workspaceId,
                    contentItemId: itemId,
                    action: "ITEM_TAGGED",
                    details: { addedTagIds: addTagIds },
                    actor: "owner",
                }
            })
        }

        if (removeTagIds && Array.isArray(removeTagIds) && removeTagIds.length > 0) {
            await prisma.contentItemTag.deleteMany({
                where: {
                    contentItemId: itemId,
                    tagId: { in: removeTagIds },
                }
            })
        }

        // 通过名称添加标签（如果标签不存在则创建）
        if (addTagName && typeof addTagName === "string" && addTagName.trim()) {
            const tagName = addTagName.trim()
            
            // 查找或创建标签
            let tag = await prisma.tag.findUnique({
                where: {
                    workspaceId_name: {
                        workspaceId: existingItem.workspaceId,
                        name: tagName,
                    }
                }
            })

            if (!tag) {
                tag = await prisma.tag.create({
                    data: {
                        workspaceId: existingItem.workspaceId,
                        name: tagName,
                        color: "#3b82f6",
                    }
                })
            }

            // 添加关联
            await prisma.contentItemTag.upsert({
                where: {
                    contentItemId_tagId: {
                        contentItemId: itemId,
                        tagId: tag.id,
                    }
                },
                update: {},
                create: {
                    contentItemId: itemId,
                    tagId: tag.id,
                }
            })

            // 记录审计日志
            await prisma.auditLog.create({
                data: {
                    workspaceId: existingItem.workspaceId,
                    contentItemId: itemId,
                    action: "ITEM_TAGGED",
                    details: { addedTagName: tagName, tagId: tag.id },
                    actor: "owner",
                }
            })
        }

        const item = await prisma.contentItem.update({
            where: { id: itemId },
            data: updateData,
            include: {
                pool: { select: { id: true, name: true } },
                tags: {
                    include: { tag: true }
                }
            }
        })

        // Format response
        const formattedItem = {
            ...item,
            tags: item.tags.map(t => t.tag),
        }

        return NextResponse.json({ item: formattedItem })
    } catch (error) {
        console.error("Failed to update content item:", error)
        return NextResponse.json(
            { error: "Failed to update content item" },
            { status: 500 }
        )
    }
}

// DELETE /api/content-items/[itemId] - 删除内容条目
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ itemId: string }> }
) {
    try {
        const { itemId } = await params

        await prisma.contentItem.delete({
            where: { id: itemId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete content item:", error)
        return NextResponse.json(
            { error: "Failed to delete content item" },
            { status: 500 }
        )
    }
}
