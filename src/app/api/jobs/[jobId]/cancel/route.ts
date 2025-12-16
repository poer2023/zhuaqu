import { NextRequest, NextResponse } from "next/server"
import { cancelJob } from "@/server/orchestrator/orchestrator"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        const success = await cancelJob(jobId)

        if (!success) {
            return NextResponse.json(
                { error: "Job not found or already completed/canceled" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, jobId, status: "CANCELED" })
    } catch (error) {
        console.error("Failed to cancel job:", error)
        return NextResponse.json({ error: "Failed to cancel job" }, { status: 500 })
    }
}
