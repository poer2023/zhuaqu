import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/pools/[poolId] - 获取单个素材池详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ poolId: string }> }
) {
    try {
        const { poolId } = await params

        const pool = await prisma.pool.findUnique({
            where: { id: poolId },
            include: {
                workspace: { select: { id: true, name: true } },
                _count: { select: { contentItems: true } }
            }
        })

        if (!pool) {
            return NextResponse.json(
                { error: "Pool not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ pool })
    } catch (error) {
        console.error("Failed to fetch pool:", error)
        return NextResponse.json(
            { error: "Failed to fetch pool" },
            { status: 500 }
        )
    }
}

// PATCH /api/pools/[poolId] - 更新素材池
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ poolId: string }> }
) {
    try {
        const { poolId } = await params
        const body = await request.json()
        const { name, description, isArchived } = body

        const updateData: Record<string, unknown> = {}
        if (name !== undefined) updateData.name = name
        if (description !== undefined) updateData.description = description
        if (isArchived !== undefined) updateData.isArchived = isArchived

        const pool = await prisma.pool.update({
            where: { id: poolId },
            data: updateData,
        })

        return NextResponse.json({ pool })
    } catch (error) {
        console.error("Failed to update pool:", error)
        return NextResponse.json(
            { error: "Failed to update pool" },
            { status: 500 }
        )
    }
}

// DELETE /api/pools/[poolId] - 删除素材池
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ poolId: string }> }
) {
    try {
        const { poolId } = await params

        // 获取素材池信息以找到工作区的默认池
        const pool = await prisma.pool.findUnique({
            where: { id: poolId },
            include: {
                workspace: {
                    select: { id: true, defaultPoolId: true }
                }
            }
        })

        if (!pool) {
            return NextResponse.json(
                { error: "Pool not found" },
                { status: 404 }
            )
        }

        // 不能删除默认素材池
        if (pool.workspace.defaultPoolId === poolId) {
            return NextResponse.json(
                { error: "Cannot delete the default pool. Please set another pool as default first." },
                { status: 400 }
            )
        }

        // 将该池中的内容移动到默认池
        if (pool.workspace.defaultPoolId) {
            await prisma.contentItem.updateMany({
                where: { poolId },
                data: { poolId: pool.workspace.defaultPoolId }
            })
        }

        // 删除素材池
        await prisma.pool.delete({
            where: { id: poolId }
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete pool:", error)
        return NextResponse.json(
            { error: "Failed to delete pool" },
            { status: 500 }
        )
    }
}

