import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// GET /api/ingest/jobs/[jobId] - 获取入库任务详情
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        const job = await prisma.ingestJob.findUnique({
            where: { id: jobId },
            include: {
                pool: { select: { id: true, name: true } },
                workspace: { select: { id: true, name: true } },
            }
        })

        if (!job) {
            return NextResponse.json(
                { error: "Ingest job not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ job })
    } catch (error) {
        console.error("Failed to fetch ingest job:", error)
        return NextResponse.json(
            { error: "Failed to fetch ingest job" },
            { status: 500 }
        )
    }
}
