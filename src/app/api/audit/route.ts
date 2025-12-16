import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/audit - 获取审计日志
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")
        const contentItemId = searchParams.get("contentItemId")
        const action = searchParams.get("action")
        const page = parseInt(searchParams.get("page") || "1")
        const limit = parseInt(searchParams.get("limit") || "50")
        const skip = (page - 1) * limit

        const where: Record<string, unknown> = {}
        if (workspaceId) where.workspaceId = workspaceId
        if (contentItemId) where.contentItemId = contentItemId
        if (action) where.action = action

        const [logs, total] = await Promise.all([
            prisma.auditLog.findMany({
                where,
                include: {
                    contentItem: {
                        select: {
                            id: true,
                            sourceUrl: true,
                            authorHandle: true,
                            textOriginal: true,
                        }
                    }
                },
                skip,
                take: limit,
                orderBy: { createdAt: "desc" }
            }),
            prisma.auditLog.count({ where })
        ])

        return NextResponse.json({
            logs,
            pageInfo: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            }
        })
    } catch (error) {
        console.error("Failed to fetch audit logs:", error)
        return NextResponse.json(
            { error: "Failed to fetch audit logs" },
            { status: 500 }
        )
    }
}
