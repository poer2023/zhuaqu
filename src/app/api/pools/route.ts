import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/pools - 获取所有素材池
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")

        const pools = await prisma.pool.findMany({
            where: {
                ...(workspaceId && { workspaceId }),
                isArchived: false,
            },
            include: {
                workspace: {
                    select: { id: true, name: true }
                },
                _count: {
                    select: { contentItems: true }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ pools })
    } catch (error) {
        console.error("Failed to fetch pools:", error)
        return NextResponse.json(
            { error: "Failed to fetch pools" },
            { status: 500 }
        )
    }
}

// POST /api/pools - 创建新素材池
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, name, description } = body

        if (!workspaceId || !name) {
            return NextResponse.json(
                { error: "Workspace ID and pool name are required" },
                { status: 400 }
            )
        }

        const pool = await prisma.pool.create({
            data: {
                workspaceId,
                name,
                description,
            }
        })

        return NextResponse.json({ pool }, { status: 201 })
    } catch (error) {
        console.error("Failed to create pool:", error)
        return NextResponse.json(
            { error: "Failed to create pool" },
            { status: 500 }
        )
    }
}
