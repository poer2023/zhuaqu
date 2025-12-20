import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// Define types locally since Prisma types are dynamically generated
type OrchestratorJobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"
type OrchestratorJobType = "INGEST_URL" | "SYNC_LIKES" | "SYNC_BOOKMARKS" | "SYNC_TIMELINE" | "REWRITE" | "PUBLISH" | "PIPELINE"
type OrchestratorStepType = "CAPTURE" | "EXTRACT" | "MEDIA" | "REWRITE" | "QA" | "SCHEDULE" | "PUBLISH"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    // 基础过滤
    const workspaceId = searchParams.get("workspaceId")
    const poolId = searchParams.get("poolId")
    const type = searchParams.get("type") as OrchestratorJobType | null
    const status = searchParams.get("status") as OrchestratorJobStatus | null

    // 高级过滤
    const stepType = searchParams.get("stepType") as OrchestratorStepType | null
    const hasError = searchParams.get("hasError") === "true"
    const hasFailed = searchParams.get("hasFailed") === "true"

    // 搜索
    const jobId = searchParams.get("jobId")
    const traceId = searchParams.get("traceId")
    const contentItemId = searchParams.get("contentItemId")

    // 分页
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)))
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10))

    // 排序
    const sortBy = searchParams.get("sortBy") || "createdAt"
    const sortOrder = searchParams.get("sortOrder") === "asc" ? "asc" : "desc"

    // 构建查询条件
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {}

    if (workspaceId) where.workspaceId = workspaceId
    if (poolId) where.poolId = poolId
    if (type) where.type = type
    if (status) where.status = status
    if (traceId) where.traceId = traceId

    // 模糊搜索 jobId
    if (jobId) {
      where.id = { contains: jobId }
    }

    // 关联 contentItem 搜索
    if (contentItemId) {
      where.contentItems = { some: { id: contentItemId } }
    }

    // OPT-M3: Merge step filters into a single condition to avoid overwriting
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stepConditions: any[] = []
    if (hasFailed) {
      stepConditions.push({ status: "FAILED" })
    }
    if (hasError) {
      stepConditions.push({ error: { not: {} } })
    }
    if (stepType) {
      stepConditions.push({ type: stepType })
    }
    // Apply combined step filter
    if (stepConditions.length > 0) {
      where.steps = {
        some: stepConditions.length === 1
          ? stepConditions[0]
          : { AND: stepConditions }
      }
    }

    // 排序选项
    const orderBy =
      sortBy === "updatedAt" ? { updatedAt: sortOrder as "asc" | "desc" } :
        sortBy === "status" ? { status: sortOrder as "asc" | "desc" } :
          { createdAt: sortOrder as "asc" | "desc" }

    // 查询 jobs
    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          steps: {
            orderBy: { position: "asc" },
            select: {
              id: true,
              type: true,
              status: true,
              position: true,
              attemptCount: true,
              maxAttempts: true,
              availableAt: true,
              createdAt: true,
              startedAt: true,
              completedAt: true,
              leaseOwner: true,
              leaseExpiresAt: true,
              error: true,
            },
          },
          workspace: { select: { id: true, name: true } },
          pool: { select: { id: true, name: true } },
        },
        take: limit,
        skip: offset,
        orderBy,
      }),
      prisma.job.count({ where }),
    ])

    // 计算聚合统计
    const stats = await prisma.job.groupBy({
      by: ["status"],
      where: workspaceId ? { workspaceId } : undefined,
      _count: { id: true },
    })

    const statusCounts = stats.reduce(
      (acc: Record<string, number>, s: { status: string; _count: { id: number } }) => {
        acc[s.status] = s._count.id
        return acc
      },
      {} as Record<string, number>
    )

    return NextResponse.json({
      jobs,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + jobs.length < total,
      },
      stats: {
        byStatus: statusCounts,
      },
    })
  } catch (error) {
    console.error("Failed to fetch jobs:", error)
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 })
  }
}
