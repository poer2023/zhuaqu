"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PageShell } from "@/components/layout/PageShell"
import {
    RefreshCw,
    Play,
    Pause,
    X,
    Trash2,
    Plus,
    Heart,
    Bookmark,
    Clock,
    CheckCircle2,
    XCircle,
    Loader2
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useSyncStore } from "@/stores/syncStore"
import { useTranslations } from "@/stores/localeStore"

export default function SyncPage() {
    const { t } = useTranslations()
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newJobSource, setNewJobSource] = useState<"LIKES" | "BOOKMARKS" | "TIMELINE">("LIKES")
    const [newJobPoolIdByWorkspace, setNewJobPoolIdByWorkspace] = useState<Record<string, string>>({})
    const [newJobLimit, setNewJobLimit] = useState(100)
    const [mediaOnly, setMediaOnly] = useState(false)
    const [includeReplies, setIncludeReplies] = useState(false)

    const { currentWorkspace, currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const {
        jobs,
        isLoading,
        isSubmitting,
        fetchJobs,
        createJob,
        pauseJob,
        resumeJob,
        cancelJob,
        deleteJob
    } = useSyncStore()

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    useEffect(() => {
        if (currentWorkspaceId) {
            fetchJobs(currentWorkspaceId)
        }
    }, [currentWorkspaceId, fetchJobs])

    const defaultPoolId = currentWorkspace?.pools?.length
        ? (currentWorkspace.defaultPoolId || currentWorkspace.pools[0].id)
        : ""
    const selectedNewJobPoolId = currentWorkspaceId ? (newJobPoolIdByWorkspace[currentWorkspaceId] ?? "") : ""
    const effectiveNewJobPoolId = selectedNewJobPoolId || defaultPoolId

    const handleCreateJob = async () => {
        if (!currentWorkspaceId || !effectiveNewJobPoolId) return

        await createJob({
            workspaceId: currentWorkspaceId,
            poolId: effectiveNewJobPoolId,
            source: newJobSource,
            options: { limit: newJobLimit, mediaOnly, includeReplies }
        })
        setShowCreateDialog(false)
    }

    const getSourceIcon = (source: string) => {
        switch (source) {
            case "LIKES": return Heart
            case "BOOKMARKS": return Bookmark
            default: return RefreshCw
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case "COMPLETED": return "text-green-600 bg-green-50 border-green-200"
            case "RUNNING": return "text-blue-600 bg-blue-50 border-blue-200"
            case "PAUSED": return "text-amber-600 bg-amber-50 border-amber-200"
            case "FAILED": return "text-red-600 bg-red-50 border-red-200"
            case "CANCELLED": return "text-zinc-500 bg-zinc-50 border-zinc-200"
            default: return "text-zinc-500 bg-zinc-50 border-zinc-200"
        }
    }

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "COMPLETED": return CheckCircle2
            case "RUNNING": return Loader2
            case "PAUSED": return Pause
            case "FAILED": return XCircle
            default: return Clock
        }
    }

    return (
        <PageShell
            title={t.nav?.sync || "Sync Jobs"}
            description="Batch import from Likes, Bookmarks, or Timeline"
            headerAction={
                <Button
                    size="sm"
                    className="h-8 px-3 text-xs font-medium"
                    onClick={() => setShowCreateDialog(true)}
                >
                    <Plus className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    {t.common.create}
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Create Dialog */}
                {showCreateDialog && (
                    <div className="p-4 rounded-lg border border-border/60 bg-card/50 space-y-4">
                        <h3 className="font-medium text-sm">{t.common.create} Sync Job</h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Source</label>
                                <Select value={newJobSource} onValueChange={(v) => setNewJobSource(v as typeof newJobSource)}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="LIKES">
                                            <div className="flex items-center gap-2">
                                                <Heart className="h-3.5 w-3.5" />
                                                Likes
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="BOOKMARKS">
                                            <div className="flex items-center gap-2">
                                                <Bookmark className="h-3.5 w-3.5" />
                                                Bookmarks
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="TIMELINE">
                                            <div className="flex items-center gap-2">
                                                <RefreshCw className="h-3.5 w-3.5" />
                                                Timeline
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Target Pool</label>
                                <Select
                                    value={effectiveNewJobPoolId}
                                    onValueChange={(poolId) => {
                                        if (!currentWorkspaceId) return
                                        setNewJobPoolIdByWorkspace((prev) => ({ ...prev, [currentWorkspaceId]: poolId }))
                                    }}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue placeholder="Select pool..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {currentWorkspace?.pools?.map(pool => (
                                            <SelectItem key={pool.id} value={pool.id}>{pool.name}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Limit</label>
                                <Select value={String(newJobLimit)} onValueChange={(v) => setNewJobLimit(Number(v))}>
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="50">50 items</SelectItem>
                                        <SelectItem value="100">100 items</SelectItem>
                                        <SelectItem value="200">200 items</SelectItem>
                                        <SelectItem value="500">500 items</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="col-span-3 grid grid-cols-2 gap-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="mediaOnly"
                                        checked={mediaOnly}
                                        onCheckedChange={(c) => setMediaOnly(c === true)}
                                    />
                                    <label
                                        htmlFor="mediaOnly"
                                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Media Only (Skip text tweets)
                                    </label>
                                </div>
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="includeReplies"
                                        checked={includeReplies}
                                        onCheckedChange={(c) => setIncludeReplies(c === true)}
                                    />
                                    <label
                                        htmlFor="includeReplies"
                                        className="text-xs font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                                    >
                                        Include Replies
                                    </label>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button variant="outline" size="sm" onClick={() => setShowCreateDialog(false)}>
                                {t.common.cancel}
                            </Button>
                            <Button size="sm" onClick={handleCreateJob} disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                                {t.common.create}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Jobs List */}
                {isLoading ? (
                    <div className="h-64 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : jobs.length === 0 ? (
                    <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                        <RefreshCw className="h-8 w-8 mb-3 opacity-30" strokeWidth={1.5} />
                        <p className="text-sm">No sync jobs yet</p>
                        <p className="text-xs mt-1">Create a job to import from Likes or Bookmarks</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {jobs.map((job) => {
                            const SourceIcon = getSourceIcon(job.source)
                            const StatusIcon = getStatusIcon(job.status)
                            const progress = job.progress || { discovered: 0, ingested: 0, failed: 0, deduped: 0 }
                            const progressPercent = job.totalItems > 0
                                ? Math.round((progress.ingested + progress.failed + progress.deduped) / job.totalItems * 100)
                                : 0

                            return (
                                <div
                                    key={job.id}
                                    className="p-4 rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center">
                                                <SourceIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-sm">{job.source}</span>
                                                    <Badge variant="outline" className={cn("text-[9px]", getStatusColor(job.status))}>
                                                        <StatusIcon className={cn("h-2.5 w-2.5 mr-1", job.status === "RUNNING" && "animate-spin")} />
                                                        {job.status}
                                                    </Badge>
                                                </div>
                                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                                    → {job.pool?.name || job.poolId} · Created {format(new Date(job.createdAt), "MM/dd HH:mm")}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            {job.status === "RUNNING" && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => pauseJob(job.id)}>
                                                    <Pause className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </Button>
                                            )}
                                            {job.status === "PAUSED" && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => resumeJob(job.id)}>
                                                    <Play className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </Button>
                                            )}
                                            {(job.status === "RUNNING" || job.status === "PAUSED" || job.status === "PENDING") && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => cancelJob(job.id)}>
                                                    <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </Button>
                                            )}
                                            {(job.status === "COMPLETED" || job.status === "CANCELLED" || job.status === "FAILED") && (
                                                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => deleteJob(job.id)}>
                                                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress */}
                                    <div className="space-y-2">
                                        <div className="h-1.5 bg-muted/50 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-blue-500 transition-all duration-300"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                            <span>Discovered: <strong className="text-foreground">{progress.discovered}</strong></span>
                                            <span>Ingested: <strong className="text-green-600">{progress.ingested}</strong></span>
                                            <span>Deduped: <strong className="text-amber-600">{progress.deduped}</strong></span>
                                            <span>Failed: <strong className="text-red-600">{progress.failed}</strong></span>
                                        </div>
                                    </div>

                                    {job.error && (
                                        <div className="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/10 p-2 rounded">
                                            {job.error}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </PageShell>
    )
}
