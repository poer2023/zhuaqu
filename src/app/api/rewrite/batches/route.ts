import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { createJobWithSteps } from "@/server/orchestrator"
import type { Prisma } from "@prisma/client"

// GET /api/rewrite/batches - 获取改写批次列表
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const workspaceId = searchParams.get("workspaceId")
    const status = searchParams.get("status")
    const limit = parseInt(searchParams.get("limit") || "20")

    const batches = await prisma.rewriteBatch.findMany({
      where: {
        ...(workspaceId && { workspaceId }),
        ...(status && { status: status as "QUEUED" | "RUNNING" | "DONE" | "PARTIAL_FAILED" }),
      },
      include: {
        preset: { select: { id: true, name: true } },
        workspace: { select: { id: true, name: true } },
        _count: { select: { versions: true } },
      },
      take: limit,
      orderBy: { createdAt: "desc" },
    })

    return NextResponse.json({ batches })
  } catch (error) {
    console.error("Failed to fetch rewrite batches:", error)
    return NextResponse.json({ error: "Failed to fetch rewrite batches" }, { status: 500 })
  }
}

// POST /api/rewrite/batches - 创建改写批次（异步：由 worker 执行）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { workspaceId, itemIds, presetId, name, params } = body

    if (!workspaceId || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return NextResponse.json({ error: "workspaceId and itemIds are required" }, { status: 400 })
    }

    const items = await prisma.contentItem.findMany({
      where: { id: { in: itemIds }, workspaceId },
      select: { id: true },
    })
    if (items.length === 0) {
      return NextResponse.json({ error: "No valid items found" }, { status: 400 })
    }

    const presetConfig = presetId ? await prisma.rewritePreset.findUnique({ where: { id: presetId } }) : null
    const resolvedParams = (params ||
      (presetConfig
        ? {
          targetPersona: presetConfig.targetPersona ?? undefined,
          audienceTone: presetConfig.audienceTone ?? undefined,
          stance: presetConfig.stance ?? undefined,
          outputFormat: presetConfig.outputFormat ?? undefined,
          includeHook: presetConfig.includeHook,
          includeConclusion: presetConfig.includeConclusion,
          includeCTA: presetConfig.includeCTA,
          requireFactCheck: presetConfig.requireFactCheck,
          includeSource: presetConfig.includeSource,
          language: presetConfig.language ?? undefined,
        }
        : {
          targetPersona: "专业内容创作者",
          audienceTone: "专业但易懂",
          stance: "neutral",
          outputFormat: "single",
          language: "zh",
        })) as Prisma.InputJsonValue

    const { batch, orchestrationJobId } = await prisma.$transaction(async (tx) => {
      const batch = await tx.rewriteBatch.create({
        data: {
          workspaceId,
          presetId,
          name: name || `改写批次 ${new Date().toLocaleDateString("zh-CN")}`,
          params: resolvedParams,
          status: "QUEUED",
          total: items.length,
        },
      })

      const { job } = await createJobWithSteps(
        {
          type: "REWRITE",
          workspaceId,
          config: { rewriteBatchId: batch.id } as Prisma.InputJsonValue,
          steps: [
            {
              type: "REWRITE",
              status: "QUEUED",
              maxAttempts: 1,
              inputRef: {
                mode: "batch",
                rewriteBatchId: batch.id,
                itemIds,
                presetId: presetId ?? null,
                params: resolvedParams,
              } as Prisma.InputJsonValue,
            },
          ],
        },
        tx
      )

      await tx.rewriteBatch.update({ where: { id: batch.id }, data: { jobId: job.id } })

      await tx.contentItem.updateMany({
        where: { id: { in: itemIds }, workspaceId },
        data: { rewriteStatus: "DRAFTING" },
      })

      await tx.auditLog.create({
        data: {
          workspaceId,
          action: "REWRITE_CREATED",
          details: { batchId: batch.id, orchestrationJobId: job.id, total: items.length } as Prisma.InputJsonValue,
          actor: "system",
        },
      })

      return { batch, orchestrationJobId: job.id }
    })

    return NextResponse.json(
      {
        batch: {
          id: batch.id,
          status: batch.status,
          total: batch.total,
          succeeded: batch.succeeded,
          failed: batch.failed,
          orchestrationJobId,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Failed to create rewrite batch:", error)
    return NextResponse.json({ error: "Failed to create rewrite batch" }, { status: 500 })
  }
}
