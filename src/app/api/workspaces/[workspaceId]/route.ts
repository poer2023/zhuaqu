import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/workspaces/[workspaceId] - 获取单个工作区详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params

        const workspace = await prisma.workspace.findUnique({
            where: { id: workspaceId },
            include: {
                pools: {
                    where: { isArchived: false },
                    include: {
                        _count: { select: { contentItems: true } }
                    }
                },
                tags: true,
                rewritePresets: true,
                _count: {
                    select: {
                        contentItems: true,
                        publishJobs: true,
                        ingestJobs: true,
                    }
                }
            }
        })

        if (!workspace) {
            return NextResponse.json(
                { error: "Workspace not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ workspace })
    } catch (error) {
        console.error("Failed to fetch workspace:", error)
        return NextResponse.json(
            { error: "Failed to fetch workspace" },
            { status: 500 }
        )
    }
}

// PATCH /api/workspaces/[workspaceId] - 更新工作区
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params
        const body = await request.json()
        const { name, description, defaultPoolId, settings } = body

        const workspace = await prisma.workspace.update({
            where: { id: workspaceId },
            data: {
                ...(name && { name }),
                ...(description !== undefined && { description }),
                ...(defaultPoolId && { defaultPoolId }),
                ...(settings && { settings }),
            }
        })

        return NextResponse.json({ workspace })
    } catch (error) {
        console.error("Failed to update workspace:", error)
        return NextResponse.json(
            { error: "Failed to update workspace" },
            { status: 500 }
        )
    }
}

// DELETE /api/workspaces/[workspaceId] - 删除工作区
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ workspaceId: string }> }
) {
    try {
        const { workspaceId } = await params

        await prisma.workspace.delete({
            where: { id: workspaceId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete workspace:", error)
        return NextResponse.json(
            { error: "Failed to delete workspace" },
            { status: 500 }
        )
    }
}
