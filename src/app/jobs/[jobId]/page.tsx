"use client"

import { useCallback, useEffect, useState, use } from "react"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Loader2,
  ArrowLeft,
  RefreshCw,
  RotateCw,
  AlertCircle,
  CheckCircle2,
  Pause,
  Clock,
  ChevronDown,
  ChevronUp,
  XCircle,
  Play,
  FileText,
  Terminal,
} from "lucide-react"

// ==================== Types ====================

type JobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"

type Step = {
  id: string
  type: string
  status: string
  position: number
  attemptCount: number
  maxAttempts: number
  availableAt?: string
  inputRef: unknown
  outputRef: unknown
  error: unknown
  createdAt: string
  startedAt?: string | null
  completedAt?: string | null
  leaseOwner?: string | null
  leaseExpiresAt?: string | null
}

type StepEvent = {
  id: string
  type: string
  data: unknown
  createdAt: string
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

// ==================== Helper Functions ====================

function getStatusBadgeClass(status: string): string {
  switch (status) {
    case "DONE":
    case "SUCCEEDED":
      return "text-green-700 bg-green-50 border-green-200 dark:bg-green-900/10 dark:text-green-300 dark:border-green-900/30"
    case "RUNNING":
      return "text-blue-700 bg-blue-50 border-blue-200 dark:bg-blue-900/10 dark:text-blue-300 dark:border-blue-900/30"
    case "PAUSED":
    case "QUEUED":
      return "text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-900/10 dark:text-amber-300 dark:border-amber-900/30"
    case "FAILED":
      return "text-red-700 bg-red-50 border-red-200 dark:bg-red-900/10 dark:text-red-300 dark:border-red-900/30"
    case "CANCELED":
    case "SKIPPED":
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

function formatTime(dateStr?: string | null): string {
  if (!dateStr) return "-"
  return new Date(dateStr).toLocaleString()
}

function calculateBackoff(attemptCount: number): string {
  const base = 5
  const cappedAttempt = Math.max(1, Math.min(6, attemptCount))
  const seconds = base * Math.pow(3, cappedAttempt - 1)
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  return `${Math.round(seconds / 3600)}h`
}

// ==================== StepDetail Panel ====================

function StepDetailPanel({
  step,
  events,
  isLoadingEvents,
  onRefreshEvents,
  onRetry,
  onRerunFrom,
  isUpdating,
}: {
  step: Step
  events: StepEvent[]
  isLoadingEvents: boolean
  onRefreshEvents: () => void
  onRetry: () => void
  onRerunFrom: () => void
  isUpdating: boolean
}) {
  const [activeTab, setActiveTab] = useState<"output" | "logs" | "error">("output")
  const hasError = step.error != null && JSON.stringify(step.error) !== "{}"
  const errorData = step.error as { code?: string; message?: string; retryable?: boolean; category?: string; at?: string } | null

  return (
    <div className="mt-3 border-t pt-3 space-y-3">
      {/* Tabs */}
      <div className="flex gap-2">
        <Button
          variant={activeTab === "output" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setActiveTab("output")}
        >
          <FileText className="h-3 w-3 mr-1" />
          输出
        </Button>
        <Button
          variant={activeTab === "logs" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => setActiveTab("logs")}
        >
          <Terminal className="h-3 w-3 mr-1" />
          日志 ({events.length})
        </Button>
        {hasError && (
          <Button
            variant={activeTab === "error" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs text-red-600"
            onClick={() => setActiveTab("error")}
          >
            <AlertCircle className="h-3 w-3 mr-1" />
            错误
          </Button>
        )}
      </div>

      {/* Content */}
      {activeTab === "output" && (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">outputRef</div>
          <pre className="text-[10px] bg-muted/30 border rounded-md p-2 max-h-48 overflow-auto">
            {formatJson(step.outputRef)}
          </pre>
        </div>
      )}

      {activeTab === "logs" && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Step Events</span>
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={onRefreshEvents} disabled={isLoadingEvents}>
              {isLoadingEvents ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            </Button>
          </div>
          <div className="max-h-48 overflow-auto space-y-1">
            {events.length === 0 ? (
              <div className="text-xs text-muted-foreground p-2">暂无日志</div>
            ) : (
              events.map((e) => {
                const data = e.data as { message?: string; delta?: string; level?: string }
                return (
                  <div
                    key={e.id}
                    className={cn(
                      "text-[10px] p-1.5 rounded border",
                      e.type === "error" ? "bg-red-50 border-red-200 dark:bg-red-900/10" : "bg-muted/30"
                    )}
                  >
                    <span className="text-muted-foreground">[{new Date(e.createdAt).toLocaleTimeString()}]</span>{" "}
                    <Badge variant="outline" className="text-[8px] h-3 px-1 mr-1">
                      {e.type}
                    </Badge>
                    {data?.message || data?.delta || JSON.stringify(data)}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      {activeTab === "error" && hasError && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground">Error Code:</span>{" "}
              <span className="font-mono">{errorData?.code || "UNKNOWN"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Retryable:</span>{" "}
              <Badge variant={errorData?.retryable ? "secondary" : "destructive"} className="text-[9px] h-4">
                {errorData?.retryable ? "Yes" : "No"}
              </Badge>
            </div>
            <div>
              <span className="text-muted-foreground">Category:</span>{" "}
              <span>{errorData?.category || "unknown"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">At:</span> {formatTime(errorData?.at)}
            </div>
          </div>
          <div className="text-xs text-muted-foreground">Message</div>
          <pre className="text-[10px] bg-red-50/50 border border-red-200 rounded-md p-2 max-h-32 overflow-auto text-red-700 dark:bg-red-900/10 dark:border-red-900/30 dark:text-red-300">
            {errorData?.message || formatJson(step.error)}
          </pre>
        </div>
      )}

      {/* Step Meta */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10px] text-muted-foreground border-t pt-2">
        <div>
          <div className="font-medium">Attempts</div>
          <div>
            {step.attemptCount}/{step.maxAttempts}
          </div>
        </div>
        <div>
          <div className="font-medium">Next Backoff</div>
          <div>{calculateBackoff(step.attemptCount)}</div>
        </div>
        <div>
          <div className="font-medium">Available At</div>
          <div>{formatTime(step.availableAt)}</div>
        </div>
        <div>
          <div className="font-medium">Lease Owner</div>
          <div>{step.leaseOwner || "-"}</div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2 border-t">
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onRerunFrom} disabled={isUpdating}>
          <RotateCw className="h-3 w-3 mr-1" />
          从此步重跑
        </Button>
        {step.status === "FAILED" && (
          <Button size="sm" className="h-7 text-xs" onClick={onRetry} disabled={isUpdating}>
            <RotateCw className="h-3 w-3 mr-1" />
            重试
          </Button>
        )}
      </div>
    </div>
  )
}

// ==================== Step Row ====================

function StepRow({
  step,
  jobId,
  onUpdate,
  isUpdating,
}: {
  step: Step
  jobId: string
  onUpdate: () => void
  isUpdating: boolean
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [events, setEvents] = useState<StepEvent[]>([])
  const [isLoadingEvents, setIsLoadingEvents] = useState(false)

  const fetchEvents = useCallback(async () => {
    setIsLoadingEvents(true)
    try {
      const res = await fetch(`/api/steps/${step.id}/events?limit=50`)
      if (res.ok) {
        const data = await res.json()
        setEvents(data.events || [])
      }
    } finally {
      setIsLoadingEvents(false)
    }
  }, [step.id])

  useEffect(() => {
    if (isExpanded && events.length === 0) {
      fetchEvents()
    }
  }, [isExpanded, events.length, fetchEvents])

  const handleRetry = async () => {
    const res = await fetch(`/api/steps/${step.id}/retry`, { method: "POST" })
    if (res.ok) onUpdate()
  }

  const handleRerunFrom = async () => {
    const res = await fetch(`/api/jobs/${jobId}/rerun-from`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stepId: step.id, clearOutput: true }),
    })
    if (res.ok) onUpdate()
  }

  const hasError = step.error != null && JSON.stringify(step.error) !== "{}"

  return (
    <div className="border-b last:border-b-0">
      <div
        className="p-4 flex items-center gap-4 cursor-pointer hover:bg-muted/20"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-[10px] h-5 px-2 font-normal">
              #{step.position}
            </Badge>
            <span className="font-medium text-sm">{step.type}</span>
            <Badge variant="outline" className={cn("text-[10px] h-5 px-2", getStatusBadgeClass(step.status))}>
              {step.status}
            </Badge>
            <span className="text-[10px] text-muted-foreground">
              {step.attemptCount}/{step.maxAttempts}
            </span>
            {hasError && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            Started: {formatTime(step.startedAt)} | Completed: {formatTime(step.completedAt)}
          </div>
        </div>
        {isExpanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
        )}
      </div>

      {isExpanded && (
        <div className="px-4 pb-4">
          <StepDetailPanel
            step={step}
            events={events}
            isLoadingEvents={isLoadingEvents}
            onRefreshEvents={fetchEvents}
            onRetry={handleRetry}
            onRerunFrom={handleRerunFrom}
            isUpdating={isUpdating}
          />
        </div>
      )}
    </div>
  )
}

// ==================== Main Page ====================

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

  const handleJobAction = async (action: "pause" | "resume" | "cancel") => {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/jobs/${jobId}/${action}`, { method: "POST" })
      if (!res.ok) throw new Error(`${action} failed`)
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
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs"
            onClick={fetchJob}
            disabled={isUpdating}
          >
            {isUpdating ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
            )}
            Refresh
          </Button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* Job Header */}
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
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

            {/* Job Actions */}
            <div className="flex items-center gap-2">
              {(job.status === "PENDING" || job.status === "RUNNING") && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleJobAction("pause")}
                  disabled={isUpdating}
                >
                  <Pause className="h-3 w-3 mr-1" />
                  暂停
                </Button>
              )}
              {job.status === "PAUSED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => handleJobAction("resume")}
                  disabled={isUpdating}
                >
                  <Play className="h-3 w-3 mr-1" />
                  恢复
                </Button>
              )}
              {job.status !== "DONE" && job.status !== "CANCELED" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs text-red-600 hover:text-red-700"
                  onClick={() => handleJobAction("cancel")}
                  disabled={isUpdating}
                >
                  <XCircle className="h-3 w-3 mr-1" />
                  取消
                </Button>
              )}
            </div>
          </div>

          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <div className="text-xs text-muted-foreground">
              <div>Workspace: {job.workspace?.name || "-"}</div>
              <div>Created: {formatTime(job.createdAt)}</div>
              <div>Updated: {formatTime(job.updatedAt)}</div>
            </div>
            <div className="text-xs">
              <div className="text-muted-foreground mb-1">Config</div>
              <pre className="text-[10px] bg-muted/30 border rounded-md p-2 max-h-36 overflow-auto">
                {formatJson(job.config)}
              </pre>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-lg border bg-card">
          <div className="px-4 py-2 border-b bg-muted/20 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Steps ({job.steps.length})
          </div>
          <div>
            {job.steps.map((s) => (
              <StepRow key={s.id} step={s} jobId={job.id} onUpdate={fetchJob} isUpdating={isUpdating} />
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  )
}
