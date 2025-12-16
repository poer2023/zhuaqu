import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/tags - 获取标签列表
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

        const tags = await prisma.tag.findMany({
            where: { workspaceId },
            include: {
                _count: { select: { contentItems: true } }
            },
            orderBy: { name: "asc" }
        })

        return NextResponse.json({ tags })
    } catch (error) {
        console.error("Failed to fetch tags:", error)
        return NextResponse.json(
            { error: "Failed to fetch tags" },
            { status: 500 }
        )
    }
}

// POST /api/tags - 创建标签
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, name, color } = body

        if (!workspaceId || !name) {
            return NextResponse.json(
                { error: "workspaceId and name are required" },
                { status: 400 }
            )
        }

        // 检查是否已存在
        const existing = await prisma.tag.findUnique({
            where: {
                workspaceId_name: { workspaceId, name }
            }
        })

        if (existing) {
            return NextResponse.json(
                { error: "Tag already exists" },
                { status: 409 }
            )
        }

        const tag = await prisma.tag.create({
            data: {
                workspaceId,
                name,
                color: color || "#3b82f6",
            }
        })

        return NextResponse.json({ tag }, { status: 201 })
    } catch (error) {
        console.error("Failed to create tag:", error)
        return NextResponse.json(
            { error: "Failed to create tag" },
            { status: 500 }
        )
    }
}
