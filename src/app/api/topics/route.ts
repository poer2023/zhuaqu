import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/topics - List all topics for a workspace
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")

        if (!workspaceId) {
            return NextResponse.json(
                { error: "workspaceId is required" },
                { status: 400 }
            )
        }

        const topics = await prisma.topic.findMany({
            where: { workspaceId },
            include: {
                _count: {
                    select: {
                        discoveries: true,
                    },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ topics })
    } catch (error) {
        console.error("Failed to fetch topics:", error)
        return NextResponse.json(
            { error: "Failed to fetch topics" },
            { status: 500 }
        )
    }
}

// POST /api/topics - Create a new topic
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            workspaceId,
            name,
            description,
            type = "keyword",
            query,
            hashtags = [],
            authorHandles = [],
            xListId,
            syncEnabled = true,
            syncInterval = 60,
            minLikes = 0,
            minRetweets = 0,
            excludeReplies = true,
            excludeRetweets = true,
            language,
        } = body

        if (!workspaceId || !name) {
            return NextResponse.json(
                { error: "workspaceId and name are required" },
                { status: 400 }
            )
        }

        // Check if topic with same name exists
        const existing = await prisma.topic.findUnique({
            where: {
                workspaceId_name: { workspaceId, name },
            },
        })

        if (existing) {
            return NextResponse.json(
                { error: "Topic with this name already exists" },
                { status: 409 }
            )
        }

        const topic = await prisma.topic.create({
            data: {
                workspaceId,
                name,
                description,
                type,
                query,
                hashtags,
                authorHandles,
                xListId,
                syncEnabled,
                syncInterval,
                minLikes,
                minRetweets,
                excludeReplies,
                excludeRetweets,
                language,
                nextSyncAt: syncEnabled ? new Date() : null,
            },
        })

        return NextResponse.json({ topic }, { status: 201 })
    } catch (error) {
        console.error("Failed to create topic:", error)
        return NextResponse.json(
            { error: "Failed to create topic" },
            { status: 500 }
        )
    }
}
