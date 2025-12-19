import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { retryStep } from "@/server/orchestrator/orchestrator"
import type { OrchestratorJobType, OrchestratorStepType } from "@prisma/client"

// 批量重试失败的 steps
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { stepIds, filter } = body as {
            stepIds?: string[]
            filter?: {
                status?: string
                workspaceId?: string
                jobType?: string
                stepType?: string
            }
        }

        let targetStepIds: string[] = []

        if (stepIds && stepIds.length > 0) {
            // 指定 step IDs
            targetStepIds = stepIds
        } else if (filter) {
            // 通过过滤条件查找
            const steps = await prisma.step.findMany({
                where: {
                    status: (filter.status as "FAILED") || "FAILED",
                    ...(filter.stepType ? { type: filter.stepType as OrchestratorStepType } : {}),
                    job: {
                        ...(filter.workspaceId ? { workspaceId: filter.workspaceId } : {}),
                        ...(filter.jobType ? { type: filter.jobType as OrchestratorJobType } : {}),
                    },
                },
                select: { id: true },
                take: 100, // 限制批量操作数量
            })
            targetStepIds = steps.map((s: { id: string }) => s.id)
        }

        if (targetStepIds.length === 0) {
            return NextResponse.json({ success: true, retried: 0 })
        }

        // 批量重试
        let retried = 0
        const errors: Array<{ stepId: string; error: string }> = []

        for (const stepId of targetStepIds) {
            try {
                await retryStep(stepId)
                retried++
            } catch (e) {
                errors.push({
                    stepId,
                    error: e instanceof Error ? e.message : String(e),
                })
            }
        }

        return NextResponse.json({
            success: true,
            retried,
            failed: errors.length,
            errors: errors.slice(0, 10), // 只返回前 10 个错误
        })
    } catch (error) {
        console.error("Failed to batch retry steps:", error)
        return NextResponse.json({ error: "Failed to batch retry steps" }, { status: 500 })
    }
}
