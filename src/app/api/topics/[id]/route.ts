import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/topics/[id] - Get topic details with discoveries
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { searchParams } = new URL(request.url)
        const includeDiscoveries = searchParams.get("includeDiscoveries") === "true"
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = parseInt(searchParams.get("offset") || "0")

        const topic = await prisma.topic.findUnique({
            where: { id },
            include: includeDiscoveries
                ? {
                      discoveries: {
                          where: { isHidden: false },
                          orderBy: { viralScore: "desc" },
                          take: limit,
                          skip: offset,
                      },
                      _count: {
                          select: { discoveries: true },
                      },
                  }
                : {
                      _count: {
                          select: { discoveries: true },
                      },
                  },
        })

        if (!topic) {
            return NextResponse.json(
                { error: "Topic not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ topic })
    } catch (error) {
        console.error("Failed to fetch topic:", error)
        return NextResponse.json(
            { error: "Failed to fetch topic" },
            { status: 500 }
        )
    }
}

// PATCH /api/topics/[id] - Update topic
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()

        const topic = await prisma.topic.update({
            where: { id },
            data: {
                ...body,
                updatedAt: new Date(),
            },
        })

        return NextResponse.json({ topic })
    } catch (error) {
        console.error("Failed to update topic:", error)
        return NextResponse.json(
            { error: "Failed to update topic" },
            { status: 500 }
        )
    }
}

// DELETE /api/topics/[id] - Delete topic
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.topic.delete({
            where: { id },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete topic:", error)
        return NextResponse.json(
            { error: "Failed to delete topic" },
            { status: 500 }
        )
    }
}
