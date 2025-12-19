"use client"

import { useState, useEffect } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import {
    Loader2,
    ArrowRight,
    CheckCircle2,
    AlertCircle,
    Link2,
    Zap,
    Settings2,
} from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useIngestStore } from "@/stores/ingestStore"

interface CaptureDrawerProps {
    open: boolean
    onClose: () => void
    onSuccess?: () => void
}

export function CaptureDrawer({ open, onClose, onSuccess }: CaptureDrawerProps) {
    const [activeTab, setActiveTab] = useState<"manual" | "auto">("manual")
    const [urlInput, setUrlInput] = useState("")
    const [showOptions, setShowOptions] = useState(false)
    const [mediaMode, setMediaMode] = useState<"link" | "download">("link")

    const { currentWorkspace, currentWorkspaceId } = useWorkspaceStore()
    const { currentJob, isSubmitting, createJob, clearCurrentJob, getJob } = useIngestStore()

    const [selectedPoolIdByWorkspace, setSelectedPoolIdByWorkspace] = useState<Record<string, string>>({})

    const defaultPoolId = currentWorkspace?.pools?.length
        ? (currentWorkspace.defaultPoolId || currentWorkspace.pools[0].id)
        : ""
    const selectedPoolId = currentWorkspaceId ? (selectedPoolIdByWorkspace[currentWorkspaceId] ?? "") : ""
    const effectivePoolId = selectedPoolId || defaultPoolId

    const urls = urlInput.split('\n').filter(Boolean)

    // Poll job status
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

    // Success callback
    useEffect(() => {
        if (currentJobStatus === "DONE" && onSuccess) {
            onSuccess()
        }
    }, [currentJobStatus, onSuccess])

    const handleIngest = async () => {
        if (!currentWorkspaceId || !effectivePoolId || urls.length === 0) return

        await createJob({
            workspaceId: currentWorkspaceId,
            poolId: effectivePoolId,
            urls,
            tags: [],
            options: { mediaMode },
        })
    }

    const handleClear = () => {
        setUrlInput("")
        clearCurrentJob()
    }

    const handleClose = () => {
        handleClear()
        onClose()
    }

    return (
        <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
            <SheetContent className="w-full sm:max-w-lg p-0 gap-0">
                <SheetHeader className="px-4 py-3 border-b">
                    <SheetTitle className="text-base">采集/入库</SheetTitle>
                </SheetHeader>

                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "manual" | "auto")} className="flex-1 flex flex-col">
                    <TabsList className="w-full justify-start rounded-none border-b bg-transparent h-auto p-0">
                        <TabsTrigger
                            value="manual"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-2.5"
                        >
                            <Link2 className="h-4 w-4 mr-2" />
                            手动导入
                        </TabsTrigger>
                        <TabsTrigger
                            value="auto"
                            className="rounded-none border-b-2 border-transparent data-[state=active]:border-foreground data-[state=active]:bg-transparent px-4 py-2.5"
                        >
                            <Zap className="h-4 w-4 mr-2" />
                            自动同步
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="manual" className="flex-1 flex flex-col p-4 space-y-4 mt-0">
                        {/* URL Input */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                URLs (每行一个)
                            </Label>
                            <Textarea
                                className="min-h-[160px] text-sm font-mono resize-none"
                                placeholder="https://x.com/user/status/123...&#10;https://twitter.com/user/status/456..."
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                            />
                            <div className="text-xs text-muted-foreground">
                                {urls.length} links
                            </div>
                        </div>

                        {/* Destination */}
                        <div className="space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Destination
                            </Label>
                            <Select
                                value={effectivePoolId}
                                onValueChange={(poolId) => {
                                    if (!currentWorkspaceId) return
                                    setSelectedPoolIdByWorkspace((prev) => ({ ...prev, [currentWorkspaceId]: poolId }))
                                }}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select pool..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentWorkspace?.pools?.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Options Toggle */}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-fit text-muted-foreground"
                            onClick={() => setShowOptions(!showOptions)}
                        >
                            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                            {showOptions ? "Hide Options" : "Options"}
                        </Button>

                        {showOptions && (
                            <div className="p-3 rounded-lg border bg-muted/30 space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
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
                        )}

                        {/* Job Result */}
                        {currentJob && (
                            <div className="p-4 rounded-lg border bg-background animate-in slide-in-from-top-2">
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
                                        {currentJob.succeeded}/{currentJob.total}
                                    </Badge>
                                </div>
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
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2 mt-auto">
                            <Button variant="outline" size="sm" onClick={handleClear} disabled={!urlInput && !currentJob}>
                                Clear
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1"
                                disabled={isSubmitting || urls.length === 0 || !effectivePoolId}
                                onClick={handleIngest}
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        Start Ingest
                                        <ArrowRight className="h-4 w-4 ml-2" />
                                    </>
                                )}
                            </Button>
                        </div>
                    </TabsContent>

                    <TabsContent value="auto" className="flex-1 p-4 mt-0">
                        <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                            <Zap className="h-10 w-10 mb-4 opacity-40" />
                            <p className="text-sm mb-2">自动同步功能</p>
                            <p className="text-xs mb-4">从 Likes/Bookmarks 自动采集内容</p>
                            <Button variant="outline" size="sm" onClick={() => window.location.href = "/automation"}>
                                前往自动化页面
                            </Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </SheetContent>
        </Sheet>
    )
}
