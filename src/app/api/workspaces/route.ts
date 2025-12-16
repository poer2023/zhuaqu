import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/workspaces - 获取所有工作区
export async function GET() {
    try {
        const workspaces = await prisma.workspace.findMany({
            include: {
                pools: {
                    where: { isArchived: false },
                    select: {
                        id: true,
                        name: true,
                        _count: {
                            select: { contentItems: true }
                        }
                    }
                },
                _count: {
                    select: {
                        contentItems: true,
                        tags: true,
                    }
                }
            },
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ workspaces })
    } catch (error) {
        console.error("Failed to fetch workspaces:", error)
        return NextResponse.json(
            { error: "Failed to fetch workspaces" },
            { status: 500 }
        )
    }
}

// POST /api/workspaces - 创建新工作区
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { name, description } = body

        if (!name) {
            return NextResponse.json(
                { error: "Workspace name is required" },
                { status: 400 }
            )
        }

        // 创建工作区及默认素材池
        const workspace = await prisma.workspace.create({
            data: {
                name,
                description,
                pools: {
                    create: {
                        name: "默认素材池",
                    }
                }
            },
            include: {
                pools: true
            }
        })

        // 更新默认素材池 ID
        await prisma.workspace.update({
            where: { id: workspace.id },
            data: { defaultPoolId: workspace.pools[0].id }
        })

        return NextResponse.json({ workspace }, { status: 201 })
    } catch (error) {
        console.error("Failed to create workspace:", error)
        return NextResponse.json(
            { error: "Failed to create workspace" },
            { status: 500 }
        )
    }
}
