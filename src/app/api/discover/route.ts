import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/discover - Get discovered content feed
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")
        const topicId = searchParams.get("topicId")
        const filter = searchParams.get("filter") || "all" // all, bookmarked, not_imported
        const sortBy = searchParams.get("sortBy") || "viral" // viral, recent, likes
        const limit = parseInt(searchParams.get("limit") || "50")
        const offset = parseInt(searchParams.get("offset") || "0")

        if (!workspaceId) {
            return NextResponse.json(
                { error: "workspaceId is required" },
                { status: 400 }
            )
        }

        // Build where clause
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const where: any = {
            isHidden: false,
            topic: {
                workspaceId,
                isActive: true,
            },
        }

        if (topicId) {
            where.topicId = topicId
        }

        if (filter === "bookmarked") {
            where.isBookmarked = true
        } else if (filter === "not_imported") {
            where.isImported = false
        }

        // Build orderBy
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let orderBy: any = { viralScore: "desc" }
        if (sortBy === "recent") {
            orderBy = { discoveredAt: "desc" }
        } else if (sortBy === "likes") {
            orderBy = { likeCount: "desc" }
        }

        const [discoveries, total] = await Promise.all([
            prisma.discoveredContent.findMany({
                where,
                orderBy,
                take: limit,
                skip: offset,
                include: {
                    topic: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            }),
            prisma.discoveredContent.count({ where }),
        ])

        return NextResponse.json({
            discoveries,
            pagination: {
                total,
                limit,
                offset,
                hasMore: offset + discoveries.length < total,
            },
        })
    } catch (error) {
        console.error("Failed to fetch discoveries:", error)
        return NextResponse.json(
            { error: "Failed to fetch discoveries" },
            { status: 500 }
        )
    }
}

// PATCH /api/discover - Update discovered content (bookmark, hide, etc.)
export async function PATCH(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, discoveryId, workspaceId, isBookmarked } = body

        if (!discoveryId || !workspaceId) {
            return NextResponse.json(
                { error: "discoveryId and workspaceId are required" },
                { status: 400 }
            )
        }

        // Verify discovery belongs to workspace
        const discovery = await prisma.discoveredContent.findFirst({
            where: {
                id: discoveryId,
                topic: { workspaceId },
            },
        })

        if (!discovery) {
            return NextResponse.json(
                { error: "Discovery not found or access denied" },
                { status: 404 }
            )
        }

        if (action === "bookmark") {
            const updated = await prisma.discoveredContent.update({
                where: { id: discoveryId },
                data: { isBookmarked: Boolean(isBookmarked) },
                select: { id: true, isBookmarked: true },
            })

            return NextResponse.json({ success: true, discovery: updated })
        }

        return NextResponse.json(
            { error: "Invalid action" },
            { status: 400 }
        )
    } catch (error) {
        console.error("Failed to update discovery:", error)
        return NextResponse.json(
            { error: "Failed to update discovery" },
            { status: 500 }
        )
    }
}

// POST /api/discover - Import discovered content to pool
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { discoveryIds, poolId, workspaceId } = body

        if (!discoveryIds || !Array.isArray(discoveryIds) || discoveryIds.length === 0) {
            return NextResponse.json(
                { error: "discoveryIds array is required" },
                { status: 400 }
            )
        }

        if (!poolId || !workspaceId) {
            return NextResponse.json(
                { error: "poolId and workspaceId are required" },
                { status: 400 }
            )
        }

        // Fetch discoveries
        const discoveries = await prisma.discoveredContent.findMany({
            where: {
                id: { in: discoveryIds },
                isImported: false,
            },
        })

        if (discoveries.length === 0) {
            return NextResponse.json(
                { error: "No valid discoveries to import" },
                { status: 400 }
            )
        }

        // Create content items
        const results = await Promise.all(
            discoveries.map(async (discovery) => {
                try {
                    // Check for duplicates
                    const existing = await prisma.contentItem.findUnique({
                        where: {
                            workspaceId_sourceId: {
                                workspaceId,
                                sourceId: discovery.sourceId,
                            },
                        },
                    })

                    if (existing) {
                        return { id: discovery.id, status: "duplicate", contentItemId: existing.id }
                    }

                    // Create content item
                    const contentItem = await prisma.contentItem.create({
                        data: {
                            workspaceId,
                            poolId,
                            sourceId: discovery.sourceId,
                            sourceUrl: discovery.sourceUrl,
                            authorHandle: discovery.authorHandle,
                            authorName: discovery.authorName,
                            authorAvatar: discovery.authorAvatar,
                            textOriginal: discovery.textContent,
                            media: discovery.media as object,
                            rawJson: discovery.rawJson as object,
                            captureStatus: "READY",
                        },
                    })

                    // Update discovery
                    await prisma.discoveredContent.update({
                        where: { id: discovery.id },
                        data: {
                            isImported: true,
                            importedAt: new Date(),
                            contentItemId: contentItem.id,
                        },
                    })

                    // Update topic stats
                    await prisma.topic.update({
                        where: { id: discovery.topicId },
                        data: {
                            totalImported: { increment: 1 },
                        },
                    })

                    return { id: discovery.id, status: "imported", contentItemId: contentItem.id }
                } catch (err) {
                    console.error(`Failed to import discovery ${discovery.id}:`, err)
                    return { id: discovery.id, status: "error", error: String(err) }
                }
            })
        )

        const imported = results.filter((r) => r.status === "imported").length
        const duplicates = results.filter((r) => r.status === "duplicate").length
        const errors = results.filter((r) => r.status === "error").length

        return NextResponse.json({
            results,
            summary: { imported, duplicates, errors, total: discoveryIds.length },
        })
    } catch (error) {
        console.error("Failed to import discoveries:", error)
        return NextResponse.json(
            { error: "Failed to import discoveries" },
            { status: 500 }
        )
    }
}
