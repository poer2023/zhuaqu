"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"
import { cn } from "@/lib/utils"
import {
  Loader2,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Pause,
  Clock,
  Filter,
  X,
  Search,
  RotateCw,
} from "lucide-react"

// ==================== Types ====================

type JobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"

type JobType =
  | "INGEST_URL"
  | "SYNC_LIKES"
  | "SYNC_BOOKMARKS"
  | "SYNC_TIMELINE"
  | "REWRITE"
  | "PUBLISH"
  | "PIPELINE"

type StepType = "CAPTURE" | "EXTRACT" | "MEDIA" | "REWRITE" | "QA" | "SCHEDULE" | "PUBLISH"

type StepSummary = {
  id: string
  type: string
  status: string
  attemptCount: number
  maxAttempts: number
  error?: unknown
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

type Filters = {
  status: JobStatus | ""
  type: JobType | ""
  stepType: StepType | ""
  hasError: boolean
  search: string
}

type Stats = {
  byStatus: Record<string, number>
}

// ==================== Constants ====================

const JOB_STATUSES: JobStatus[] = ["PENDING", "RUNNING", "PAUSED", "FAILED", "DONE", "CANCELED"]
const JOB_TYPES: JobType[] = ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "REWRITE", "PUBLISH", "PIPELINE"]
const STEP_TYPES: StepType[] = ["CAPTURE", "EXTRACT", "MEDIA", "REWRITE", "QA", "SCHEDULE", "PUBLISH"]

// ==================== Helper Functions ====================

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

function getStatusIcon(status: JobStatus, className: string): React.ReactNode {
  switch (status) {
    case "DONE":
      return <CheckCircle2 className={className} />
    case "RUNNING":
      return <Loader2 className={className} />
    case "PAUSED":
      return <Pause className={className} />
    case "FAILED":
      return <AlertCircle className={className} />
    default:
      return <Clock className={className} />
  }
}

// ==================== Components ====================

function FilterBar({
  filters,
  onFilterChange,
  stats,
  onBatchRetry,
  selectedJobs,
  isRetrying,
}: {
  filters: Filters
  onFilterChange: (f: Partial<Filters>) => void
  stats?: Stats
  onBatchRetry: () => void
  selectedJobs: string[]
  isRetrying: boolean
}) {
  const hasFilters = filters.status || filters.type || filters.stepType || filters.hasError || filters.search

  return (
    <div className="space-y-3 mb-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="搜索 Job ID / Trace ID / Content Item ID..."
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          className="w-full pl-9 pr-4 py-2 text-sm border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      {/* Filter Row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="h-4 w-4 text-muted-foreground" />

        {/* Status */}
        <select
          value={filters.status}
          onChange={(e) => onFilterChange({ status: e.target.value as JobStatus | "" })}
          className="text-xs border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">所有状态</option>
          {JOB_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s} {stats?.byStatus[s] ? `(${stats.byStatus[s]})` : ""}
            </option>
          ))}
        </select>

        {/* Type */}
        <select
          value={filters.type}
          onChange={(e) => onFilterChange({ type: e.target.value as JobType | "" })}
          className="text-xs border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">所有类型</option>
          {JOB_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Step Type */}
        <select
          value={filters.stepType}
          onChange={(e) => onFilterChange({ stepType: e.target.value as StepType | "" })}
          className="text-xs border rounded-md px-2 py-1.5 bg-background"
        >
          <option value="">所有 Step</option>
          {STEP_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Has Error */}
        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={filters.hasError}
            onChange={(e) => onFilterChange({ hasError: e.target.checked })}
            className="rounded"
          />
          <span>只看错误</span>
        </label>

        {/* Clear Filters */}
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => onFilterChange({ status: "", type: "", stepType: "", hasError: false, search: "" })}
          >
            <X className="h-3 w-3 mr-1" />
            清除
          </Button>
        )}

        {/* Quick DLQ Filter */}
        <Button
          variant={filters.status === "FAILED" ? "secondary" : "outline"}
          size="sm"
          className="h-7 text-xs ml-auto"
          onClick={() => onFilterChange({ status: filters.status === "FAILED" ? "" : "FAILED" })}
        >
          <AlertCircle className="h-3 w-3 mr-1" />
          DLQ ({stats?.byStatus?.FAILED || 0})
        </Button>
      </div>

      {/* Batch Actions */}
      {selectedJobs.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
          <span className="text-xs text-muted-foreground">已选 {selectedJobs.length} 个</span>
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={onBatchRetry} disabled={isRetrying}>
            {isRetrying ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <RotateCw className="h-3 w-3 mr-1" />}
            批量重试
          </Button>
        </div>
      )}
    </div>
  )
}

function JobCard({
  job,
  isSelected,
  onSelect,
}: {
  job: JobSummary
  isSelected: boolean
  onSelect: (id: string, selected: boolean) => void
}) {
  const iconClassName = cn("h-4 w-4", job.status === "RUNNING" && "animate-spin")
  const hasError = job.steps.some((s) => s.status === "FAILED" || (s.error && JSON.stringify(s.error) !== "{}"))

  return (
    <div className="rounded-lg border bg-card hover:bg-muted/20 transition-colors">
      <div className="p-4 flex items-center gap-4">
        {/* Selection */}
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation()
            onSelect(job.id, e.target.checked)
          }}
          className="rounded shrink-0"
        />

        <Link href={`/jobs/${job.id}`} className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {getStatusIcon(job.status, iconClassName)}
            <span className="font-medium text-sm truncate">{job.type}</span>
            <Badge variant="outline" className={cn("text-[10px] h-5 px-2", getStatusBadgeClass(job.status))}>
              {job.status}
            </Badge>
            {job.pool?.name && (
              <Badge variant="secondary" className="text-[10px] h-5 px-2">
                {job.pool.name}
              </Badge>
            )}
            {hasError && <AlertCircle className="h-3.5 w-3.5 text-red-500" />}
          </div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {job.steps.map((s) => (
              <Badge
                key={s.id}
                variant="secondary"
                className={cn(
                  "text-[9px] h-4 px-1.5 font-normal",
                  s.status === "FAILED" && "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                )}
              >
                {s.type}:{s.status} {s.attemptCount}/{s.maxAttempts}
              </Badge>
            ))}
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {new Date(job.createdAt).toLocaleString()}
          </div>
        </Link>

        <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
      </div>
    </div>
  )
}

// ==================== Main Page ====================

export default function JobsPage() {
  const { t } = useTranslations()
  const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

  const [jobs, setJobs] = useState<JobSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | undefined>(undefined)
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [isRetrying, setIsRetrying] = useState(false)

  const [filters, setFilters] = useState<Filters>({
    status: "",
    type: "",
    stepType: "",
    hasError: false,
    search: "",
  })

  const fetchJobs = useCallback(async () => {
    if (!currentWorkspaceId) return
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set("workspaceId", currentWorkspaceId)
      params.set("limit", "100")
      if (filters.status) params.set("status", filters.status)
      if (filters.type) params.set("type", filters.type)
      if (filters.stepType) params.set("stepType", filters.stepType)
      if (filters.hasError) params.set("hasFailed", "true")
      if (filters.search) params.set("jobId", filters.search)

      const res = await fetch(`/api/jobs?${params.toString()}`)
      if (!res.ok) throw new Error("Failed to fetch jobs")
      const data = await res.json()
      setJobs(data.jobs || [])
      setStats(data.stats)
    } catch (e) {
      setError(String(e))
    } finally {
      setIsLoading(false)
    }
  }, [currentWorkspaceId, filters])

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    if (currentWorkspaceId) fetchJobs()
  }, [currentWorkspaceId, fetchJobs])

  const handleFilterChange = (partial: Partial<Filters>) => {
    setFilters((f) => ({ ...f, ...partial }))
    setSelectedJobs([])
  }

  const handleSelect = (id: string, selected: boolean) => {
    setSelectedJobs((prev) => (selected ? [...prev, id] : prev.filter((x) => x !== id)))
  }

  const handleBatchRetry = async () => {
    if (selectedJobs.length === 0) return
    setIsRetrying(true)
    try {
      // Get failed step IDs for selected jobs
      const failedStepIds = jobs
        .filter((j) => selectedJobs.includes(j.id))
        .flatMap((j) => j.steps.filter((s) => s.status === "FAILED").map((s) => s.id))

      if (failedStepIds.length === 0) {
        alert("没有找到失败的 step")
        return
      }

      const res = await fetch("/api/steps/batch-retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepIds: failedStepIds }),
      })

      if (!res.ok) throw new Error("Batch retry failed")

      const data = await res.json()
      alert(`重试成功: ${data.retried} 个 step`)
      setSelectedJobs([])
      await fetchJobs()
    } catch (e) {
      alert(`重试失败: ${e}`)
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <PageShell
      title={(t.nav as Record<string, string>)?.jobs || "Jobs"}
      description="统一查看 ingest/sync/rewrite/publish 的执行时间线"
      headerAction={
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={fetchJobs}
          disabled={!currentWorkspaceId || isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
          )}
          {t.common.refresh}
        </Button>
      }
    >
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        stats={stats}
        onBatchRetry={handleBatchRetry}
        selectedJobs={selectedJobs}
        isRetrying={isRetrying}
      />

      {isLoading && jobs.length === 0 ? (
        <div className="h-64 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-red-700 text-sm">{error}</div>
      ) : jobs.length === 0 ? (
        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
          <Clock className="h-8 w-8 mb-3 opacity-30" strokeWidth={1.5} />
          <p className="text-sm">No jobs found</p>
          <p className="text-xs mt-1">
            {filters.status || filters.type || filters.stepType || filters.hasError
              ? "尝试清除过滤条件"
              : "Create an ingest/sync/rewrite/publish job to see it here"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Select All */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={selectedJobs.length === jobs.length && jobs.length > 0}
              onChange={(e) => setSelectedJobs(e.target.checked ? jobs.map((j) => j.id) : [])}
              className="rounded"
            />
            <span>全选</span>
            <span className="ml-auto">共 {jobs.length} 个任务</span>
          </div>

          {jobs.map((job) => (
            <JobCard key={job.id} job={job} isSelected={selectedJobs.includes(job.id)} onSelect={handleSelect} />
          ))}
        </div>
      )}
    </PageShell>
  )
}
