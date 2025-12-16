import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params

    const job = await prisma.job.findUnique({
      where: { id: jobId },
      include: {
        steps: { orderBy: { position: "asc" } },
        workspace: { select: { id: true, name: true } },
        pool: { select: { id: true, name: true } },
      },
    })

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 })
    }

    return NextResponse.json({ job })
  } catch (error) {
    console.error("Failed to fetch job:", error)
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 })
  }
}

