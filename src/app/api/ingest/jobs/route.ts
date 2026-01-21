import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { parseTweetUrl } from "@/server/x/parseTweetUrl"
import { createJobWithSteps } from "@/server/orchestrator"
import { errorResponse, ErrorCodes } from "@/lib/apiResponse"
import { defaultApiLimiter } from "@/lib/rate-limit"
import { apiLogger } from "@/lib/logger"

const log = apiLogger("/api/ingest/jobs", "POST")

// GET /api/ingest/jobs - 获取入库任务列表
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")
        const status = searchParams.get("status")
        const limit = parseInt(searchParams.get("limit") || "20")

        const jobs = await prisma.ingestJob.findMany({
            where: {
                ...(workspaceId && { workspaceId }),
                ...(status && { status: status as "QUEUED" | "RUNNING" | "DONE" | "PARTIAL_FAILED" }),
            },
            include: {
                pool: { select: { id: true, name: true } },
                workspace: { select: { id: true, name: true } },
            },
            take: limit,
            orderBy: { createdAt: "desc" }
        })

        return NextResponse.json({ jobs })
    } catch (error) {
        log.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to fetch ingest jobs")
        return errorResponse(
            ErrorCodes.DATABASE_ERROR,
            "Failed to fetch ingest jobs",
            500
        )
    }
}

// POST /api/ingest/jobs - 创建入库任务
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, poolId, urls, tags, notes, options } = body

        if (!workspaceId || !poolId || !urls || !Array.isArray(urls)) {
            return NextResponse.json(
                { error: "workspaceId, poolId, and urls are required" },
                { status: 400 }
            )
        }

        const parsed = urls
            .map((u: string) => parseTweetUrl(u))
            .filter((u): u is NonNullable<ReturnType<typeof parseTweetUrl>> => Boolean(u))

        if (parsed.length === 0) {
            return NextResponse.json(
                { error: "No valid X/Twitter URLs found" },
                { status: 400 }
            )
        }

        const normalizedUrls = parsed.map((p) => p.canonicalUrl)

        const result = await prisma.$transaction(async (tx) => {
            const ingestJob = await tx.ingestJob.create({
                data: {
                    workspaceId,
                    poolId,
                    urls: normalizedUrls,
                    tags: Array.isArray(tags) ? tags : [],
                    notes,
                    options: options || {},
                    status: "QUEUED",
                    total: normalizedUrls.length,
                },
            })

            const { job: orchestrationJob } = await createJobWithSteps(
                {
                    type: "INGEST_URL",
                    workspaceId,
                    poolId,
                    config: {
                        ingestJobId: ingestJob.id,
                        urls: normalizedUrls,
                        options: options || {},
                        tags: Array.isArray(tags) ? tags : [],
                        notes: notes ?? null,
                    },
                    steps: [
                        {
                            type: "CAPTURE",
                            maxAttempts: 3,
                            inputRef: { ingestJobId: ingestJob.id },
                        },
                    ],
                },
                tx
            )

            const updatedIngestJob = await tx.ingestJob.update({
                where: { id: ingestJob.id },
                data: { jobId: orchestrationJob.id },
            })

            await tx.auditLog.create({
                data: {
                    workspaceId,
                    action: "INGEST_CREATED",
                    details: { jobId: updatedIngestJob.id, orchestrationJobId: orchestrationJob.id, total: normalizedUrls.length },
                    actor: "owner",
                },
            })

            return { ingestJob: updatedIngestJob, orchestrationJobId: orchestrationJob.id }
        })

        return NextResponse.json({ job: result.ingestJob, orchestrationJobId: result.orchestrationJobId }, { status: 201 })

    } catch (error) {
        log.error({ error: error instanceof Error ? error.message : String(error) }, "Failed to create ingest job")
        return NextResponse.json(
            { error: "Failed to create ingest job" },
            { status: 500 }
        )
    }
}
