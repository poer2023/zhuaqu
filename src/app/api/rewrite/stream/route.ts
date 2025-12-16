import { NextRequest } from "next/server"
import prisma from "@/lib/prisma"
import { createJobWithSteps, retryStep } from "@/server/orchestrator"
import type { Prisma } from "@prisma/client"
import crypto from "crypto"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function hashParams(params: unknown): string {
  const stable = JSON.stringify(params ?? {})
  return crypto.createHash("sha256").update(stable).digest("hex").slice(0, 24)
}

function extractTextFromOutputRef(outputRef: unknown): string {
  if (!isRecord(outputRef)) return ""
  const text = outputRef.text
  return typeof text === "string" ? text : ""
}

function extractErrorMessage(error: unknown): string | null {
  if (!isRecord(error)) return null
  const message = error.message
  if (typeof message === "string" && message.trim()) return message
  const code = error.code
  if (typeof code === "string" && code.trim()) return code
  return null
}

// POST /api/rewrite/stream - SSE: 由 worker 执行 rewrite step，SSE 订阅 step 输出
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}))

  const contentItemId = typeof body.contentItemId === "string" ? body.contentItemId : null
  const originalText = typeof body.originalText === "string" ? body.originalText : null
  const params = (isRecord(body.params) ? body.params : {}) as Prisma.InputJsonValue
  const force = body.force === true

  const inferredWorkspaceId = contentItemId
    ? (await prisma.contentItem.findUnique({ where: { id: contentItemId }, select: { workspaceId: true } }))?.workspaceId || null
    : null
  const workspaceId = typeof body.workspaceId === "string" ? body.workspaceId : inferredWorkspaceId

  if (!workspaceId) {
    return new Response(JSON.stringify({ error: "workspaceId is required (or provide contentItemId)" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }
  if (!contentItemId && !originalText) {
    return new Response(JSON.stringify({ error: "contentItemId or originalText is required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    })
  }

  const paramsKey = hashParams(params)
  let idempotencyKey: string | null = null
  if (contentItemId) {
    const base = `stream:${contentItemId}:${paramsKey}`
    if (force) {
      const latest = await prisma.rewriteVersion.findFirst({
        where: { contentItemId },
        orderBy: { version: "desc" },
        select: { version: true },
      })
      const nextVersion = (latest?.version || 0) + 1
      idempotencyKey = `${base}:v${nextVersion}`
    } else {
      idempotencyKey = base
    }
  }

  const { job, steps } = await createJobWithSteps({
    type: "REWRITE",
    workspaceId,
    config: { mode: "stream", contentItemId, params } as Prisma.InputJsonValue,
    idempotencyKey,
    steps: [
      {
        type: "REWRITE",
        status: "QUEUED",
        maxAttempts: 1,
        inputRef: { mode: "stream", contentItemId, originalText, params } as Prisma.InputJsonValue,
      },
    ],
  })

  const stepId = steps[0]?.id
  if (!stepId) {
    return new Response(JSON.stringify({ error: "Failed to create step" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  if (!force && steps[0]?.status === "FAILED") {
    await retryStep(stepId)
  }

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      let sentLen = 0
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ jobId: job.id, stepId })}\n\n`))

      while (true) {
        const step = await prisma.step.findUnique({
          where: { id: stepId },
          select: { status: true, outputRef: true, error: true },
        })
        if (!step) break

        const text = extractTextFromOutputRef(step.outputRef)
        if (text.length > sentLen) {
          const delta = text.slice(sentLen)
          sentLen = text.length
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`))
        }

        if (step.status === "SUCCEEDED" || step.status === "SKIPPED") {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`))
          break
        }

        if (step.status === "FAILED") {
          const message = extractErrorMessage(step.error) || "Rewrite failed"
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: message })}\n\n`))
          break
        }

        await sleep(250)
      }

      controller.close()
    },
  })

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
