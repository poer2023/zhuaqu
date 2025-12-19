"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { PageShell } from "@/components/layout/PageShell"
import { Link2, Settings2, Loader2, ArrowRight, Plus, CheckCircle2, XCircle, AlertCircle } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useIngestStore } from "@/stores/ingestStore"
import { useTranslations } from "@/stores/localeStore"

export default function IngestPage() {
    const { t } = useTranslations()
    const [urlInput, setUrlInput] = useState("")
    const [showOptions, setShowOptions] = useState(false)
    const [selectedPoolIdByWorkspace, setSelectedPoolIdByWorkspace] = useState<Record<string, string>>({})
    const [mediaMode, setMediaMode] = useState<"link" | "download">("link")
    const [threadMode, setThreadMode] = useState<"single" | "thread">("single")
    const [quoteMode, setQuoteMode] = useState<"ignore" | "follow">("ignore")

    // Zustand stores
    const { workspaces, currentWorkspace, currentWorkspaceId, fetchWorkspaces, isLoading: wsLoading } = useWorkspaceStore()
    const { currentJob, isSubmitting, createJob, clearCurrentJob, getJob } = useIngestStore()

    // 加载工作区
    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    const urls = urlInput.split('\n').filter(Boolean)
    const defaultPoolId = currentWorkspace?.pools?.length
        ? (currentWorkspace.defaultPoolId || currentWorkspace.pools[0].id)
        : ""
    const selectedPoolId = currentWorkspaceId ? (selectedPoolIdByWorkspace[currentWorkspaceId] ?? "") : ""
    const effectivePoolId = selectedPoolId || defaultPoolId
    const selectedTags: string[] = []

    const handleIngest = async () => {
        if (!currentWorkspaceId || !effectivePoolId || urls.length === 0) return

        await createJob({
            workspaceId: currentWorkspaceId,
            poolId: effectivePoolId,
            urls,
            tags: selectedTags,
            options: { mediaMode, threadMode, quoteMode },
        })
    }

    const handleClear = () => {
        setUrlInput("")
        clearCurrentJob()
    }

    // Poll job status while queued/running (worker updates progress async)
    const currentJobId = currentJob?.id
    const currentJobStatus = currentJob?.status
    useEffect(() => {
        if (!currentJobId) return
        if (currentJobStatus === "DONE" || currentJobStatus === "PARTIAL_FAILED") return

        void getJob(currentJobId)
        const interval = setInterval(() => {
            void getJob(currentJobId)
        }, 1500)

        return () => clearInterval(interval)
    }, [currentJobId, currentJobStatus, getJob])

    return (
        <PageShell title={t.ingest.title} description={t.ingest.description}>
            <div className="space-y-8">
                <div className="grid lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-4">
                        {/* Main Input */}
                        <div className="relative group">
                            <div className="absolute top-4 left-4 text-muted-foreground/40 pointer-events-none transition-colors group-focus-within:text-foreground/60">
                                <Link2 className="w-4 h-4" strokeWidth={1.5} />
                            </div>
                            <Textarea
                                className="min-h-[280px] pl-12 pt-4 text-sm font-mono bg-background/50 border-border/50 focus-visible:ring-1 focus-visible:ring-foreground/10 resize-none rounded-lg transition-all hover:bg-background hover:border-border"
                                placeholder="Paste X/Twitter URLs here, one per line...&#10;&#10;• https://x.com/elonmusk/status/...&#10;• https://twitter.com/sama/status/..."
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                            />
                            <div className="absolute bottom-3 right-3 text-[10px] text-muted-foreground font-mono bg-background/80 px-2 py-0.5 rounded border">
                                {urls.length} links
                            </div>
                        </div>

                        <div className="flex items-center justify-between">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-muted-foreground hover:text-foreground h-8 text-xs"
                                onClick={() => setShowOptions(!showOptions)}
                            >
                                <Settings2 className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                                {showOptions ? "Hide Options" : "Options"}
                            </Button>

                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={handleClear} disabled={!urlInput && !currentJob} className="h-8 text-xs">Clear</Button>
                                <Button size="sm" className="h-8 px-4 text-xs" disabled={isSubmitting || urls.length === 0 || !effectivePoolId} onClick={handleIngest}>
                                    {isSubmitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Start Ingest"}
                                    {!isSubmitting && <ArrowRight className="w-3.5 h-3.5 ml-1.5" strokeWidth={1.5} />}
                                </Button>
                            </div>
                        </div>

                        {showOptions && (
                            <div className="grid sm:grid-cols-2 gap-6 p-4 rounded-lg border border-border/50 bg-background/50 animate-in slide-in-from-top-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Thread Mode</Label>
                                    <Select value={threadMode} onValueChange={(v) => setThreadMode(v as "single" | "thread")}>
                                        <SelectTrigger className="bg-background/50 h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="single">Single Tweet (Current)</SelectItem>
                                            <SelectItem value="thread">Full Thread (Auto Expand)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quote Mode</Label>
                                    <Select value={quoteMode} onValueChange={(v) => setQuoteMode(v as "ignore" | "follow")}>
                                        <SelectTrigger className="bg-background/50 h-8 text-sm"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ignore">Ignore Quotes</SelectItem>
                                            <SelectItem value="follow">Follow Quotes (Capture)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Media Assets</Label>
                                    <div className="flex items-center space-x-2 pt-1">
                                        <Checkbox
                                            id="download_media"
                                            checked={mediaMode === "download"}
                                            onCheckedChange={(c) => setMediaMode(c ? "download" : "link")}
                                        />
                                        <label htmlFor="download_media" className="text-sm cursor-pointer">
                                            Download videos locally
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Job Result */}
                        {currentJob && (
                            <div className="p-4 rounded-lg border bg-background/50 animate-in slide-in-from-top-2">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        {currentJob.status === "DONE" && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                                        {currentJob.status === "RUNNING" && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                                        {currentJob.status === "PARTIAL_FAILED" && <AlertCircle className="h-4 w-4 text-amber-500" />}
                                        {currentJob.status === "QUEUED" && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
                                        <span className="text-sm font-medium">
                                            {currentJob.status === "DONE" ? "Completed" :
                                                currentJob.status === "RUNNING" ? "Processing..." :
                                                    currentJob.status === "PARTIAL_FAILED" ? "Partially Failed" : "Queued"}
                                        </span>
                                    </div>
                                    <Badge variant="outline" className="text-[10px]">
                                        {currentJob.succeeded}/{currentJob.total} succeeded
                                    </Badge>
                                </div>
                                {(currentJob.status === "QUEUED" || currentJob.status === "RUNNING") && (
                                    <div className="text-xs text-muted-foreground mb-3">
                                        入库在后台异步执行；若长时间停留在 Queued，请确认已运行 `npm run worker`。
                                    </div>
                                )}
                                <div className="grid grid-cols-3 gap-4 text-center">
                                    <div>
                                        <div className="text-lg font-semibold text-green-600">{currentJob.succeeded}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase">Succeeded</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-semibold text-amber-600">{currentJob.deduped}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase">Deduped</div>
                                    </div>
                                    <div>
                                        <div className="text-lg font-semibold text-red-600">{currentJob.failed}</div>
                                        <div className="text-[10px] text-muted-foreground uppercase">Failed</div>
                                    </div>
                                </div>
                                {currentJob.failures?.length > 0 && (
                                    <div className="mt-3 pt-3 border-t space-y-1">
                                        {currentJob.failures.map((f, i) => (
                                            <div key={i} className="flex items-start gap-2 text-xs text-red-600">
                                                <XCircle className="h-3 w-3 mt-0.5 shrink-0" />
                                                <span className="font-mono truncate">{f.url}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="space-y-6">
                        <div className="space-y-3">
                            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Destination</h2>
                            {wsLoading ? (
                                <div className="h-9 flex items-center justify-center">
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                </div>
                            ) : (
                                <>
                                    <Select value={currentWorkspaceId || ""} onValueChange={(id) => useWorkspaceStore.getState().setCurrentWorkspace(id)}>
                                        <SelectTrigger className="w-full h-9 bg-background/50 text-sm"><SelectValue placeholder="Select workspace" /></SelectTrigger>
                                        <SelectContent>
                                            {workspaces.map(w => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    <Select
                                        value={effectivePoolId}
                                        onValueChange={(poolId) => {
                                            if (!currentWorkspaceId) return
                                            setSelectedPoolIdByWorkspace((prev) => ({ ...prev, [currentWorkspaceId]: poolId }))
                                        }}
                                    >
                                        <SelectTrigger className="w-full h-9 bg-background/50 text-sm"><SelectValue placeholder="Select pool" /></SelectTrigger>
                                        <SelectContent>
                                            {currentWorkspace?.pools?.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tags</h2>
                                <Button variant="ghost" size="icon" className="h-5 w-5"><Plus className="h-3 w-3" strokeWidth={1.5} /></Button>
                            </div>
                            <div className="text-xs text-muted-foreground">
                                Tags will be loaded from API
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </PageShell>
    )
}
