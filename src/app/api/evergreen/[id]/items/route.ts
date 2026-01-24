import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// POST /api/evergreen/[id]/items - Add items to queue
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { items } = body

        if (!items || !Array.isArray(items) || items.length === 0) {
            return NextResponse.json(
                { error: "items array is required" },
                { status: 400 }
            )
        }

        // Verify queue exists
        const queue = await prisma.evergreenQueue.findUnique({
            where: { id },
        })

        if (!queue) {
            return NextResponse.json(
                { error: "Queue not found" },
                { status: 404 }
            )
        }

        // Create items
        const createdItems = await Promise.all(
            items.map(async (item: {
                contentItemId?: string
                rewriteVersionId?: string
                contentSnapshot: { text: string; media?: object[] }
            }) => {
                return prisma.evergreenItem.create({
                    data: {
                        queueId: id,
                        contentItemId: item.contentItemId,
                        rewriteVersionId: item.rewriteVersionId,
                        contentSnapshot: item.contentSnapshot as object,
                    },
                })
            })
        )

        // Update queue stats
        await prisma.evergreenQueue.update({
            where: { id },
            data: {
                totalItems: { increment: createdItems.length },
            },
        })

        return NextResponse.json({
            items: createdItems,
            count: createdItems.length,
        }, { status: 201 })
    } catch (error) {
        console.error("Failed to add items:", error)
        return NextResponse.json(
            { error: "Failed to add items" },
            { status: 500 }
        )
    }
}

// GET /api/evergreen/[id]/items - List items in queue
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const sortBy = searchParams.get("sortBy") || "weight"
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = parseInt(searchParams.get("offset") || "0")

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let orderBy: any = { weight: "desc" }
        if (sortBy === "recent") orderBy = { createdAt: "desc" }
        if (sortBy === "engagement") orderBy = { avgEngagement: "desc" }
        if (sortBy === "reposts") orderBy = { repostCount: "desc" }

        const [items, total] = await Promise.all([
            prisma.evergreenItem.findMany({
                where: { queueId: id, isActive: true },
                orderBy,
                take: limit,
                skip: offset,
            }),
            prisma.evergreenItem.count({
                where: { queueId: id, isActive: true },
            }),
        ])

        return NextResponse.json({
            items,
            pagination: { total, limit, offset, hasMore: offset + items.length < total },
        })
    } catch (error) {
        console.error("Failed to fetch items:", error)
        return NextResponse.json(
            { error: "Failed to fetch items" },
            { status: 500 }
        )
    }
}

// DELETE /api/evergreen/[id]/items - Remove items from queue
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { itemIds } = body

        if (!itemIds || !Array.isArray(itemIds)) {
            return NextResponse.json(
                { error: "itemIds array is required" },
                { status: 400 }
            )
        }

        // Soft delete by setting isActive = false
        const result = await prisma.evergreenItem.updateMany({
            where: {
                id: { in: itemIds },
                queueId: id,
            },
            data: { isActive: false },
        })

        // Update queue stats
        await prisma.evergreenQueue.update({
            where: { id },
            data: {
                totalItems: { decrement: result.count },
            },
        })

        return NextResponse.json({ removed: result.count })
    } catch (error) {
        console.error("Failed to remove items:", error)
        return NextResponse.json(
            { error: "Failed to remove items" },
            { status: 500 }
        )
    }
}
