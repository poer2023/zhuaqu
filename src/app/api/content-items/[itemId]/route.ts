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

        const { notes, rewriteStatus, publishStatus, poolId } = body

        const updateData: Record<string, unknown> = {}
        if (notes !== undefined) updateData.notes = notes
        if (rewriteStatus !== undefined) updateData.rewriteStatus = rewriteStatus
        if (publishStatus !== undefined) updateData.publishStatus = publishStatus
        if (poolId !== undefined) updateData.poolId = poolId

        const item = await prisma.contentItem.update({
            where: { id: itemId },
            data: updateData,
            include: {
                pool: { select: { id: true, name: true } },
            }
        })

        return NextResponse.json({ item })
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
