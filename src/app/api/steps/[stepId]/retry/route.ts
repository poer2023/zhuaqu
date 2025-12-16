import { NextRequest, NextResponse } from "next/server"
import { retryStep } from "@/server/orchestrator/orchestrator"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ stepId: string }> }
) {
  try {
    const { stepId } = await params

    await retryStep(stepId)

    return NextResponse.json({ success: true, stepId })
  } catch (error) {
    console.error("Failed to retry step:", error)
    return NextResponse.json({ error: "Failed to retry step" }, { status: 500 })
  }
}
