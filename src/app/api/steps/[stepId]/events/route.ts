import { NextRequest, NextResponse } from "next/server"
import { getStepEvents } from "@/server/orchestrator/stepEvents"

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ stepId: string }> }
) {
    try {
        const { stepId } = await params
        const { searchParams } = new URL(request.url)

        const since = searchParams.get("since")
        const type = searchParams.get("type") as "log" | "progress" | "output" | "error" | null
        const limit = Math.min(500, Math.max(1, parseInt(searchParams.get("limit") || "100", 10)))

        const events = await getStepEvents(stepId, {
            since: since ? new Date(since) : undefined,
            type: type || undefined,
            limit,
        })

        return NextResponse.json({
            events,
            count: events.length,
        })
    } catch (error) {
        console.error("Failed to fetch step events:", error)
        return NextResponse.json({ error: "Failed to fetch step events" }, { status: 500 })
    }
}
