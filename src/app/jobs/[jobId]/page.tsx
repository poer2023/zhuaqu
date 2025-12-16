"use client"

import { useCallback, useEffect, useState, use } from "react"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { Loader2, ArrowLeft, RefreshCw, RotateCw, AlertCircle, CheckCircle2, Pause, Clock } from "lucide-react"

type JobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"

type Step = {
  id: string
  type: string
  status: string
  position: number
  attemptCount: number
  maxAttempts: number
  inputRef: unknown
  outputRef: unknown
  error: unknown
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
}

type JobDetail = {
  id: string
  type: string
  status: JobStatus
  createdAt: string
  updatedAt: string
  config: unknown
  workspace?: { id: string; name: string } | null
  pool?: { id: string; name: string } | null
  steps: Step[]
}

function getStatusBadgeClass(status: JobStatus): string {
  switch (status) {
    case "DONE":
      return "text-green-700 bg-green-50 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-900/30"
    case "RUNNING":
      return "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-900/30"
    case "PAUSED":
      return "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-900/30"
    case "FAILED":
      return "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-900/30"
    case "CANCELED":
      return "text-zinc-600 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/20 dark:text-zinc-300 dark:border-zinc-800"
    default:
      return "text-zinc-600 bg-zinc-50 border-zinc-200 dark:bg-zinc-900/20 dark:text-zinc-300 dark:border-zinc-800"
  }
}

function getStatusIcon(status: JobStatus) {
  switch (status) {
    case "DONE":
      return CheckCircle2
    case "RUNNING":
      return Loader2
    case "PAUSED":
      return Pause
    case "FAILED":
      return AlertCircle
    default:
      return Clock
  }
}

function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export default function JobDetailPage({ params }: { params: Promise<{ jobId: string }> }) {
  const { jobId } = use(params)

  const [job, setJob] = useState<JobDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJob = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs/${jobId}`)
      if (!res.ok) throw new Error("Failed to fetch job")
      const data = await res.json()
      setJob(data.job)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoading(false)
    }
  }, [jobId])

  useEffect(() => {
    fetchJob()
  }, [fetchJob])

  const handleRetryStep = async (stepId: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/steps/${stepId}/retry`, { method: "POST" })
      if (!res.ok) throw new Error("Retry failed")
      await fetchJob()
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRerunFrom = async (stepId: string) => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/rerun-from`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId }),
      })
      if (!res.ok) throw new Error("Rerun failed")
      await fetchJob()
    } finally {
      setIsUpdating(false)
    }
  }

  if (isLoading) {
    return (
      <PageShell title="Job">
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </PageShell>
    )
  }

  if (error || !job) {
    return (
      <PageShell title="Job">
        <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-red-700 text-sm">
          {error || "Job not found"}
        </div>
        <div className="mt-4">
          <Button variant="outline" asChild>
            <Link href="/jobs">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  const Icon = getStatusIcon(job.status)

  return (
    <PageShell
      title="Job Detail"
      description={job.id}
      headerAction={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 text-xs" asChild>
            <Link href="/jobs">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
              Back
            </Link>
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchJob} disabled={isUpdating}>
            {isUpdating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />}
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center gap-2">
            <Icon className={cn("h-4 w-4", job.status === "RUNNING" && "animate-spin")} />
            <span className="font-medium text-sm">{job.type}</span>
            <Badge variant="outline" className={cn("text-[10px] h-5 px-2", getStatusBadgeClass(job.status))}>
              {job.status}
            </Badge>
            {job.pool?.name && (
              <Badge variant="secondary" className="text-[10px] h-5 px-2">
                {job.pool.name}
              </Badge>
            )}
          </div>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="text-xs text-muted-foreground">
              <div>Workspace: {job.workspace?.name || "-"}</div>
              <div>Created: {new Date(job.createdAt).toLocaleString()}</div>
              <div>Updated: {new Date(job.updatedAt).toLocaleString()}</div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground mb-1">Config</div>
              <pre className="text-[10px] bg-muted/30 border rounded-md p-2 max-h-36 overflow-auto">
                {formatJson(job.config)}
              </pre>
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-card">
          <div className="px-4 py-2 border-b bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Steps
          </div>
          <div className="divide-y">
            {job.steps.map((s) => (
              <div key={s.id} className="p-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal">
                      #{s.position}
                    </Badge>
                    <span className="font-medium text-sm">{s.type}</span>
                    <Badge variant="outline" className="text-[10px] h-5 px-2">
                      {s.status}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">
                      {s.attemptCount}/{s.maxAttempts}
                    </span>
                  </div>
                  {s.error != null && JSON.stringify(s.error) !== "{}" && (
                    <pre className="mt-2 text-[10px] bg-red-50/50 border border-red-200 rounded-md p-2 max-h-28 overflow-auto text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-300">
                      {formatJson(s.error)}
                    </pre>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => handleRerunFrom(s.id)}
                    disabled={isUpdating}
                  >
                    <RotateCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    Rerun from
                  </Button>
                  {s.status === "FAILED" && (
                    <Button
                      size="sm"
                      className="h-8 text-xs"
                      onClick={() => handleRetryStep(s.id)}
                      disabled={isUpdating}
                    >
                      <RotateCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
