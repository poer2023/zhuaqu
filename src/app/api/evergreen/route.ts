import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/evergreen - List evergreen queues
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

        const queues = await prisma.evergreenQueue.findMany({
            where: { workspaceId },
            include: {
                _count: {
                    select: { items: true },
                },
            },
            orderBy: { createdAt: "desc" },
        })

        return NextResponse.json({ queues })
    } catch (error) {
        console.error("Failed to fetch evergreen queues:", error)
        return NextResponse.json(
            { error: "Failed to fetch evergreen queues" },
            { status: 500 }
        )
    }
}

// POST /api/evergreen - Create evergreen queue
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            workspaceId,
            name,
            description,
            cycleInterval = 168,
            maxReposts = 5,
            publishWindows = [],
            timezone = "Asia/Shanghai",
            randomizeOrder = true,
            variationEnabled = false,
        } = body

        if (!workspaceId || !name) {
            return NextResponse.json(
                { error: "workspaceId and name are required" },
                { status: 400 }
            )
        }

        const queue = await prisma.evergreenQueue.create({
            data: {
                workspaceId,
                name,
                description,
                cycleInterval,
                maxReposts,
                publishWindows,
                timezone,
                randomizeOrder,
                variationEnabled,
            },
        })

        return NextResponse.json({ queue }, { status: 201 })
    } catch (error) {
        console.error("Failed to create evergreen queue:", error)
        return NextResponse.json(
            { error: "Failed to create evergreen queue" },
            { status: 500 }
        )
    }
}
