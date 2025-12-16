"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageShell } from "@/components/layout/PageShell"
import {
    Pause,
    Play,
    CalendarDays,
    Loader2,
    RefreshCw,
    X
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { usePublishStore } from "@/stores/publishStore"

export default function PublishPage() {
    // Zustand stores
    const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const {
        jobs,
        queuePaused,
        isLoading,
        fetchJobs,
        pauseQueue,
        resumeQueue,
        cancelJob,
        retryJob
    } = usePublishStore()

    // 加载工作区和发布任务
    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    useEffect(() => {
        if (currentWorkspaceId) {
            fetchJobs(currentWorkspaceId)
        }
    }, [currentWorkspaceId, fetchJobs])

    // 分类任务
    const queuedJobs = jobs.filter(j => j.status === 'QUEUED')
    const publishedJobs = jobs.filter(j => j.status === 'PUBLISHED')
    const failedJobs = jobs.filter(j => j.status === 'FAILED')

    const stats = {
        pending: queuedJobs.length,
        published: publishedJobs.length,
        failed: failedJobs.length,
        successRate: jobs.length > 0
            ? Math.round((publishedJobs.length / jobs.length) * 100 * 10) / 10
            : 0
    }

    return (
        <PageShell
            title="Publish Center"
            description="Manage your publication queue and schedule."
            headerAction={
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                            if (!currentWorkspaceId) return
                            if (queuePaused) resumeQueue(currentWorkspaceId)
                            else pauseQueue(currentWorkspaceId)
                        }}
                        className={cn("h-8 text-xs", queuePaused && "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100 dark:bg-amber-900/20 dark:border-amber-900/50 dark:text-amber-400")}
                    >
                        {queuePaused ? <Play className="h-3 w-3 mr-1.5" strokeWidth={1.5} /> : <Pause className="h-3 w-3 mr-1.5" strokeWidth={1.5} />}
                        {queuePaused ? "Resume" : "Pause"}
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="h-8 px-3 text-xs"
                        onClick={() => currentWorkspaceId && fetchJobs(currentWorkspaceId)}
                        disabled={!currentWorkspaceId || isLoading}
                    >
                        <RefreshCw className={cn("h-3 w-3 mr-1.5", isLoading && "animate-spin")} strokeWidth={1.5} />
                        Refresh
                    </Button>
                </div>
            }
        >
            <div className="space-y-8">
                <div className="grid gap-8 lg:grid-cols-3">
                    <div className="lg:col-span-2 space-y-8">
                        {/* Queued Jobs */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                Up Next ({queuedJobs.length})
                            </h2>
                            {isLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                </div>
                            ) : queuedJobs.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-4">
                                    No queued jobs. Approve rewrites to add to queue.
                                </div>
                            ) : (
                                <div className="relative border-l border-border/40 ml-2 space-y-5">
                                    {queuedJobs.map((job) => (
                                        <div key={job.id} className="relative pl-6 group">
                                            <div className={cn(
                                                "absolute -left-[4px] top-1 w-2 h-2 rounded-full ring-2 ring-background",
                                                job.status === 'QUEUED' ? "bg-blue-500 animate-pulse" : "bg-zinc-300"
                                            )}></div>

                                            <div className="flex flex-col gap-2 p-3 rounded-lg transition-all border border-transparent hover:bg-background hover:border-border/50">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] font-mono text-muted-foreground font-medium">
                                                            {job.scheduledAt ? format(new Date(job.scheduledAt), 'HH:mm') : 'ASAP'}
                                                        </span>
                                                        <Badge variant="outline" className="text-[9px] h-4 font-normal px-1.5 bg-muted/20">
                                                            {job.mode}
                                                        </Badge>
                                                    </div>
                                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-5 w-5"
                                                            onClick={() => cancelJob(job.id)}
                                                        >
                                                            <X className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                                                        </Button>
                                                    </div>
                                                </div>
                                                <p className="text-sm text-foreground/80 leading-relaxed line-clamp-2">
                                                    {(job.rewriteVersion?.output as { text: string })?.text || "No content"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Failed Jobs */}
                        {failedJobs.length > 0 && (
                            <div className="space-y-4">
                                <h2 className="text-xs font-semibold text-red-600 uppercase tracking-wider">
                                    Failed ({failedJobs.length})
                                </h2>
                                <div className="space-y-2">
                                    {failedJobs.map((job) => (
                                        <div key={job.id} className="flex items-center justify-between p-3 rounded-lg border border-red-200 bg-red-50/50 dark:bg-red-900/10 dark:border-red-900/30">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm text-foreground/80 truncate">
                                                    {(job.rewriteVersion?.output as { text: string })?.text || "No content"}
                                                </p>
                                                {job.lastError && (
                                                    <p className="text-[10px] text-red-600 mt-1 truncate">{job.lastError}</p>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs ml-2"
                                                onClick={() => retryJob(job.id)}
                                            >
                                                <RefreshCw className="h-3 w-3 mr-1" strokeWidth={1.5} /> Retry
                                            </Button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Published History */}
                        <div className="space-y-4">
                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                                History ({publishedJobs.length})
                            </h2>
                            {publishedJobs.length === 0 ? (
                                <div className="text-sm text-muted-foreground py-4">
                                    No published items yet.
                                </div>
                            ) : (
                                <div className="relative border-l border-border/40 ml-2 space-y-5 opacity-60 hover:opacity-100 transition-opacity">
                                    {publishedJobs.slice(0, 5).map((job) => (
                                        <div key={job.id} className="relative pl-6">
                                            <div className="absolute -left-[4px] top-1 w-2 h-2 rounded-full bg-green-500 ring-2 ring-background"></div>
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] font-mono text-muted-foreground">
                                                        {format(new Date(job.createdAt), 'MMM dd HH:mm')}
                                                    </span>
                                                    {job.publishResults?.[0]?.tweetUrl && (
                                                        <a
                                                            href={job.publishResults[0].tweetUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-[10px] text-blue-600 hover:underline"
                                                        >
                                                            View →
                                                        </a>
                                                    )}
                                                </div>
                                                <p className="text-sm text-foreground/80 line-clamp-1">
                                                    {(job.rewriteVersion?.output as { text: string })?.text || "No content"}
                                                </p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Stats Sidebar */}
                    <div className="space-y-4">
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stats</h2>
                        <div className="rounded-lg border border-border/60 bg-card/30 p-4 space-y-4">
                            <div className="space-y-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Queue Depth</div>
                                <div className="text-2xl font-semibold tracking-tight">
                                    {stats.pending} <span className="text-xs font-normal text-muted-foreground">pending</span>
                                </div>
                            </div>
                            <div className="space-y-1">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Success Rate</div>
                                <div className={cn(
                                    "text-2xl font-semibold tracking-tight",
                                    stats.successRate >= 90 ? "text-green-600 dark:text-green-400" :
                                        stats.successRate >= 70 ? "text-amber-600" : "text-red-600"
                                )}>
                                    {stats.successRate}%
                                </div>
                            </div>
                            <div className="border-t border-border/60 pt-4 mt-2">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <CalendarDays className="h-3.5 w-3.5" strokeWidth={1.5} />
                                    <span>{queuePaused ? "Queue paused" : "Queue active"}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    )
}
