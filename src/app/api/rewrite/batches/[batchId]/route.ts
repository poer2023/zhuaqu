import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/rewrite/batches/[batchId] - 获取改写批次详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ batchId: string }> }
) {
    try {
        const { batchId } = await params

        const batch = await prisma.rewriteBatch.findUnique({
            where: { id: batchId },
            include: {
                preset: true,
                workspace: { select: { id: true, name: true } },
                versions: {
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
                    orderBy: { createdAt: "desc" }
                }
            }
        })

        if (!batch) {
            return NextResponse.json(
                { error: "Rewrite batch not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ batch })
    } catch (error) {
        console.error("Failed to fetch rewrite batch:", error)
        return NextResponse.json(
            { error: "Failed to fetch rewrite batch" },
            { status: 500 }
        )
    }
}
