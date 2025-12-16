import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/workspaces/[workspaceId]/pools - 获取工作区的所有素材池
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params

        const pools = await prisma.pool.findMany({
            where: { workspaceId, isArchived: false },
            include: {
                _count: {
                    select: { contentItems: true }
                }
            },
            orderBy: { createdAt: "asc" }
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

// POST /api/workspaces/[workspaceId]/pools - 创建新素材池
export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params
        const { name, description } = await request.json()

        if (!name?.trim()) {
            return NextResponse.json(
                { error: "Pool name is required" },
                { status: 400 }
            )
        }

        const pool = await prisma.pool.create({
            data: {
                workspaceId,
                name: name.trim(),
                description: description?.trim() || null
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
