import { NextRequest, NextResponse } from "next/server"
import { resumeJob } from "@/server/orchestrator/orchestrator"

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await params

        const success = await resumeJob(jobId)

        if (!success) {
            return NextResponse.json(
                { error: "Job not found or cannot be resumed" },
                { status: 404 }
            )
        }

        return NextResponse.json({ success: true, jobId, status: "PENDING" })
    } catch (error) {
        console.error("Failed to resume job:", error)
        return NextResponse.json({ error: "Failed to resume job" }, { status: 500 })
    }
}
