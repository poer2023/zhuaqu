"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PageShell } from "@/components/layout/PageShell"
import {
    CheckCircle2,
    RotateCw,
    ChevronLeft,
    ChevronRight,
    ThumbsDown,
    Wand2,
    Layers,
    Loader2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useRewriteStore } from "@/stores/rewriteStore"
import { useTranslations } from "@/stores/localeStore"

export default function RewritePage() {
    const { t } = useTranslations()
    const [editedTextByVersionId, setEditedTextByVersionId] = useState<Record<string, string>>({})

    // Zustand stores
    const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const {
        batches,
        currentBatch,
        currentVersionIndex,
        isLoading,
        isSubmitting,
        isStreaming,
        streamingText,
        fetchBatches,
        getBatch,
        setCurrentVersionIndex,
        approveVersion,
        rejectVersion,
        reworkVersion,
        editVersion,
        streamRewrite,
        clearStreamingText
    } = useRewriteStore()

    // 加载工作区和批次
    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    useEffect(() => {
        if (currentWorkspaceId) {
            fetchBatches(currentWorkspaceId)
        }
    }, [currentWorkspaceId, fetchBatches])

    // 当前版本
    const currentVersion = currentBatch?.versions?.[currentVersionIndex]
    const totalVersions = currentBatch?.versions?.length || 0

    const currentVersionId = currentVersion?.id
    const currentOutputText = (() => {
        if (!currentVersion) return ""
        const output = currentVersion.output as { text?: unknown }
        return typeof output?.text === "string" ? output.text : ""
    })()
    const editedText = currentVersionId ? (editedTextByVersionId[currentVersionId] ?? currentOutputText) : ""

    const setCurrentEditedText = (next: string) => {
        if (!currentVersionId) return
        setEditedTextByVersionId((prev) => ({ ...prev, [currentVersionId]: next }))
    }

    const handleBatchSelect = async (batchId: string) => {
        await getBatch(batchId)
    }

    const goTo = (index: number) => {
        if (index >= 0 && index < totalVersions) {
            // 保存当前编辑
            if (currentVersion && editedText !== (currentVersion.output as { text: string })?.text) {
                editVersion(currentVersion.id, { text: editedText })
            }
            setCurrentVersionIndex(index)
        }
    }

    const handleApprove = async () => {
        if (!currentVersion) return
        await editVersion(currentVersion.id, { text: editedText })
        await approveVersion(currentVersion.id)
        if (currentVersionIndex < totalVersions - 1) {
            goTo(currentVersionIndex + 1)
        }
    }

    const handleReject = async () => {
        if (!currentVersion) return
        await rejectVersion(currentVersion.id)
        if (currentVersionIndex < totalVersions - 1) {
            goTo(currentVersionIndex + 1)
        }
    }

    const handleRework = async () => {
        if (!currentVersion) return
        await reworkVersion(currentVersion.id)
    }

    const handleRegenerate = async () => {
        if (!currentVersion?.contentItem?.textOriginal) return
        clearStreamingText()
        await streamRewrite(
            currentVersion.contentItem.textOriginal,
            { language: 'zh' },
            (text) => setCurrentEditedText(text),
            { workspaceId: currentWorkspaceId ?? undefined, contentItemId: currentVersion.contentItem.id }
        )
    }

    return (
        <PageShell
            variant="full"
            title="Rewrite Studio"
            className="bg-background"
            headerAction={
                <Button size="sm" className="h-8 text-xs">
                    <Layers className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    New Batch
                </Button>
            }
        >
            <div className="flex h-full border-t">
                {/* Sidebar */}
                <div className="w-56 border-r bg-muted/10 flex flex-col">
                    <div className="h-9 border-b flex items-center px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider bg-muted/5">
                        Batches
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
                        {isLoading && batches.length === 0 ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                        ) : batches.length === 0 ? (
                            <div className="text-center py-8 text-xs text-muted-foreground">
                                No batches yet
                            </div>
                        ) : (
                            batches.map(batch => (
                                <button
                                    key={batch.id}
                                    onClick={() => handleBatchSelect(batch.id)}
                                    className={cn(
                                        "w-full text-left px-2.5 py-2 rounded-md text-sm transition-all group",
                                        currentBatch?.id === batch.id
                                            ? "bg-background shadow-sm border border-border"
                                            : "hover:bg-muted/50 text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <div className="font-medium text-sm truncate">{batch.name}</div>
                                    <div className="flex justify-between mt-1 items-center">
                                        <Badge variant="secondary" className="text-[9px] h-4 font-normal px-1.5">
                                            {batch.status.toLowerCase()}
                                        </Badge>
                                        <span className="text-[10px] text-muted-foreground/70">
                                            {batch.succeeded}/{batch.total}
                                        </span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Main */}
                <div className="flex-1 flex flex-col min-w-0 bg-background/50">
                    {!currentBatch ? (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground">
                            <div className="text-center">
                                <p className="text-sm">Select a batch to start reviewing</p>
                                <p className="text-xs mt-1">Or create a new batch from the Pools page</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Toolbar */}
                            <div className="h-10 border-b px-3 flex items-center justify-between shrink-0 bg-background/80 backdrop-blur-sm z-10">
                                <div className="flex items-center gap-3">
                                    <div className="flex items-center gap-0.5 bg-muted/20 rounded-md p-0.5 border border-border/50">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded"
                                            disabled={currentVersionIndex === 0}
                                            onClick={() => goTo(currentVersionIndex - 1)}
                                        >
                                            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </Button>
                                        <span className="text-[10px] font-mono px-2 text-muted-foreground min-w-[2.5rem] text-center">
                                            {currentVersionIndex + 1}/{totalVersions}
                                        </span>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 rounded"
                                            disabled={currentVersionIndex === totalVersions - 1}
                                            onClick={() => goTo(currentVersionIndex + 1)}
                                        >
                                            <ChevronRight className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </Button>
                                    </div>
                                    <div className="h-4 w-px bg-border/60"></div>
                                    {currentVersion && (
                                        <Badge
                                            variant="outline"
                                            className={cn("text-[9px]",
                                                currentVersion.status === 'APPROVED' && "text-green-600 border-green-200 bg-green-50",
                                                currentVersion.status === 'REJECTED' && "text-red-600 border-red-200 bg-red-50",
                                                currentVersion.status === 'REWORK' && "text-amber-600 border-amber-200 bg-amber-50"
                                            )}
                                        >
                                            {currentVersion.status.toLowerCase()}
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center gap-1.5">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2 hover:bg-red-50 hover:text-red-600 text-muted-foreground"
                                        onClick={handleReject}
                                        disabled={isSubmitting}
                                    >
                                        <ThumbsDown className="h-3 w-3 mr-1" strokeWidth={1.5} /> Reject
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 text-xs px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        onClick={handleRework}
                                        disabled={isSubmitting}
                                    >
                                        <RotateCw className="h-3 w-3 mr-1" strokeWidth={1.5} /> Rework
                                    </Button>
                                    <Button
                                        size="sm"
                                        className="h-7 text-xs px-3 ml-1"
                                        onClick={handleApprove}
                                        disabled={isSubmitting}
                                    >
                                        {isSubmitting ? (
                                            <Loader2 className="h-3 w-3 animate-spin" />
                                        ) : (
                                            <><CheckCircle2 className="h-3 w-3 mr-1" strokeWidth={1.5} /> Approve</>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            {/* Split View */}
                            <div className="flex-1 grid grid-cols-2 divide-x h-full overflow-hidden">
                                <div className="p-6 overflow-y-auto bg-muted/5">
                                    <div className="max-w-md mx-auto space-y-4">
                                        <div className="flex items-center gap-2 opacity-70">
                                            <Badge variant="outline" className="text-[9px] font-mono tracking-wider">ORIGINAL</Badge>
                                            <span className="text-[10px] text-muted-foreground font-medium">
                                                @{currentVersion?.contentItem?.authorHandle || "unknown"}
                                            </span>
                                        </div>
                                        <div className="text-sm text-muted-foreground leading-relaxed">
                                            {currentVersion?.contentItem?.textOriginal || "No content"}
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 overflow-y-auto bg-background/50 relative group">
                                    <div className="max-w-md mx-auto space-y-4 h-full flex flex-col">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <Badge variant="default" className="text-[9px] font-mono tracking-wider bg-blue-600/10 text-blue-600 hover:bg-blue-600/20 border-transparent dark:text-blue-400">
                                                    GENERATED
                                                </Badge>
                                                {currentVersion?.similarityScore && (
                                                    <span className="text-[10px] text-muted-foreground font-mono">
                                                        {Math.round(currentVersion.similarityScore * 100)}%
                                                    </span>
                                                )}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={cn(
                                                    "h-6 text-[10px] transition-opacity text-muted-foreground hover:text-foreground px-2",
                                                    isStreaming ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                                )}
                                                onClick={handleRegenerate}
                                                disabled={isStreaming}
                                            >
                                                {isStreaming ? (
                                                    <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Generating...</>
                                                ) : (
                                                    <><Wand2 className="h-3 w-3 mr-1" strokeWidth={1.5} /> Regen</>
                                                )}
                                            </Button>
                                        </div>
                                        <Textarea
                                            className="flex-1 text-sm leading-relaxed border-0 p-0 focus-visible:ring-0 resize-none font-sans bg-transparent placeholder:text-muted-foreground/30"
                                            value={editedText}
                                            onChange={(e) => setCurrentEditedText(e.target.value)}
                                            placeholder="Rewrite content..."
                                        />
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </PageShell>
    )
}
