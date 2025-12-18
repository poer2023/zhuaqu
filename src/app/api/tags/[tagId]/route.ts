import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/tags/[tagId] - 获取单个标签详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ tagId: string }> }
) {
    try {
        const { tagId } = await params

        const tag = await prisma.tag.findUnique({
            where: { id: tagId },
            include: {
                _count: { select: { contentItems: true } }
            }
        })

        if (!tag) {
            return NextResponse.json(
                { error: "Tag not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ tag })
    } catch (error) {
        console.error("Failed to fetch tag:", error)
        return NextResponse.json(
            { error: "Failed to fetch tag" },
            { status: 500 }
        )
    }
}

// PATCH /api/tags/[tagId] - 更新标签
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ tagId: string }> }
) {
    try {
        const { tagId } = await params
        const body = await request.json()
        const { name, color } = body

        const updateData: Record<string, unknown> = {}
        if (name !== undefined) updateData.name = name
        if (color !== undefined) updateData.color = color

        const tag = await prisma.tag.update({
            where: { id: tagId },
            data: updateData,
        })

        return NextResponse.json({ tag })
    } catch (error) {
        console.error("Failed to update tag:", error)
        return NextResponse.json(
            { error: "Failed to update tag" },
            { status: 500 }
        )
    }
}

// DELETE /api/tags/[tagId] - 删除标签
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ tagId: string }> }
) {
    try {
        const { tagId } = await params

        // 删除标签会自动级联删除 ContentItemTag 关联（由 Prisma schema 配置）
        await prisma.tag.delete({
            where: { id: tagId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete tag:", error)
        return NextResponse.json(
            { error: "Failed to delete tag" },
            { status: 500 }
        )
    }
}

