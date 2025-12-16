"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"
import { cn } from "@/lib/utils"
import { Loader2, RefreshCw, ArrowRight, AlertCircle, CheckCircle2, Pause, Clock } from "lucide-react"

type JobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"

type JobType =
  | "INGEST_URL"
  | "SYNC_LIKES"
  | "SYNC_BOOKMARKS"
  | "SYNC_TIMELINE"
  | "REWRITE"
  | "PUBLISH"
  | "PIPELINE"

type StepSummary = {
  id: string
  type: string
  status: string
  attemptCount: number
  maxAttempts: number
}

type JobSummary = {
  id: string
  type: JobType
  status: JobStatus
  createdAt: string
  updatedAt: string
  pool?: { id: string; name: string } | null
  steps: StepSummary[]
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

export default function JobsPage() {
  const { t } = useTranslations()
  const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchJobs = useCallback(async () => {
    if (!currentWorkspaceId) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/jobs?workspaceId=${currentWorkspaceId}&limit=100`)
      if (!res.ok) throw new Error("Failed to fetch jobs")
      const data = await res.json()
      setJobs(data.jobs || [])
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspaceId])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    if (currentWorkspaceId) fetchJobs()
  }, [currentWorkspaceId, fetchJobs])

  return (
    <PageShell
      title={(t.nav as Record<string, string>)?.jobs || "Jobs"}
      description="统一查看 ingest/sync/rewrite/publish 的执行时间线"
      headerAction={
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={fetchJobs} disabled={!currentWorkspaceId || isLoading}>
          {isLoading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />}
          {t.common.refresh}
        </Button>
      }
    >
      {isLoading && jobs.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-red-700 text-sm">
          {error}
        </div>
      ) : jobs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <Clock className="h-8 w-8 mb-3 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">No jobs yet</p>
          <p className="text-xs mt-1">Create an ingest/sync/rewrite/publish job to see it here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => {
            const Icon = getStatusIcon(job.status)
            return (
              <Link
                key={job.id}
                href={`/jobs/${job.id}`}
                className="block rounded-lg border bg-card hover:bg-muted/20 transition-colors"
              >
                <div className="p-4 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={cn("h-4 w-4", job.status === "RUNNING" && "animate-spin")} />
                      <span className="font-medium text-sm truncate">{job.type}</span>
                      <Badge variant="outline" className={cn("text-[10px] h-5 px-2", getStatusBadgeClass(job.status))}>
                        {job.status}
                      </Badge>
                      {job.pool?.name && (
                        <Badge variant="secondary" className="text-[10px] h-5 px-2">
                          {job.pool.name}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {job.steps.map((s) => (
                        <Badge key={s.id} variant="secondary" className="text-[9px] h-4 px-1.5 font-normal">
                          {s.type}:{s.status} {s.attemptCount}/{s.maxAttempts}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </PageShell>
  )
}

