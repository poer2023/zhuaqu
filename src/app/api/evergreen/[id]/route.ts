import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/evergreen/[id] - Get queue with items
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const includeItems = searchParams.get("includeItems") !== "false"

        const queue = await prisma.evergreenQueue.findUnique({
            where: { id },
            include: includeItems
                ? {
                      items: {
                          where: { isActive: true },
                          orderBy: { weight: "desc" },
                      },
                      _count: { select: { items: true } },
                  }
                : { _count: { select: { items: true } } },
        })

        if (!queue) {
            return NextResponse.json(
                { error: "Queue not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ queue })
    } catch (error) {
        console.error("Failed to fetch queue:", error)
        return NextResponse.json(
            { error: "Failed to fetch queue" },
            { status: 500 }
        )
    }
}

// PATCH /api/evergreen/[id] - Update queue
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const queue = await prisma.evergreenQueue.update({
            where: { id },
            data: {
                ...body,
                updatedAt: new Date(),
            },
        })

        return NextResponse.json({ queue })
    } catch (error) {
        console.error("Failed to update queue:", error)
        return NextResponse.json(
            { error: "Failed to update queue" },
            { status: 500 }
        )
    }
}

// DELETE /api/evergreen/[id] - Delete queue
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.evergreenQueue.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete queue:", error)
        return NextResponse.json(
            { error: "Failed to delete queue" },
            { status: 500 }
        )
    }
}
