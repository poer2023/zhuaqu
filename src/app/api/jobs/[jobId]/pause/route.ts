import { NextRequest, NextResponse } from "next/server"
import { pauseJob } from "@/server/orchestrator/orchestrator"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        const success = await pauseJob(jobId)

        if (!success) {
            return NextResponse.json(
                { error: "Job not found or cannot be paused" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, jobId, status: "PAUSED" })
    } catch (error) {
        console.error("Failed to pause job:", error)
        return NextResponse.json({ error: "Failed to pause job" }, { status: 500 })
    }
}
