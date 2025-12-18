"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet"
import {
    X,
    ExternalLink,
    Calendar,
    User,
    Image as ImageIcon,
    Video,
    Tag,
    History,
    PenTool,
    Send,
    Plus,
    Check,
    Clock,
    Loader2
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/stores/localeStore"

interface ContentItem {
    id: string
    sourceId: string
    sourceUrl: string
    authorHandle: string
    authorName?: string
    textOriginal: string
    lang?: string
    media?: Array<{
        type: string
        sourceUrl: string
        localPath?: string
        width?: number
        height?: number
    }>
    captureStatus: string
    rewriteStatus: string
    publishStatus: string
    tags?: Array<{ id: string; name: string }>
    notes?: string
    createdAt: string
    updatedAt: string
    rewriteVersions?: Array<{
        id: string
        version: number
        status: string
        output: { text: string }
        createdAt: string
    }>
    auditLogs?: Array<{
        id: string
        action: string
        details: Record<string, unknown>
        createdAt: string
    }>
}

interface ContentItemDrawerProps {
    item: ContentItem | null
    open: boolean
    onClose: () => void
    onUpdate?: (item: ContentItem) => void
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

type MediaDownloadInfo = {
    status: "queued" | "ready" | "failed" | "skipped" | string
    localPath: string | null
    error: string | null
}

type MediaEntry = {
    type: "video" | "image" | string
    sourceUrl?: string
    directUrl?: string
    thumbnailUrl?: string
    width?: number
    height?: number
    ext?: string
    alt?: string
    download?: MediaDownloadInfo
}

function parseMediaEntry(value: unknown): MediaEntry | null {
    if (!isObject(value)) return null
    const type = typeof value.type === "string" ? value.type : null
    if (!type) return null

    const downloadRaw = isObject(value.download) ? value.download : null
    const download: MediaDownloadInfo | undefined = downloadRaw
        ? {
            status: typeof downloadRaw.status === "string" ? downloadRaw.status : "unknown",
            localPath: typeof downloadRaw.localPath === "string" ? downloadRaw.localPath : null,
            error: typeof downloadRaw.error === "string" ? downloadRaw.error : null,
        }
        : undefined

    return {
        type,
        sourceUrl: typeof value.sourceUrl === "string" ? value.sourceUrl : undefined,
        directUrl: typeof value.directUrl === "string" ? value.directUrl : undefined,
        thumbnailUrl: typeof value.thumbnailUrl === "string" ? value.thumbnailUrl : undefined,
        width: typeof value.width === "number" ? value.width : undefined,
        height: typeof value.height === "number" ? value.height : undefined,
        ext: typeof value.ext === "string" ? value.ext : undefined,
        alt: typeof value.alt === "string" ? value.alt : undefined,
        download,
    }
}

export function ContentItemDrawer({ item, open, onClose, onUpdate }: ContentItemDrawerProps) {
    const { t } = useTranslations()
    const [activeTab, setActiveTab] = useState<"content" | "versions" | "logs">("content")
    const [newTag, setNewTag] = useState("")
    const [notes, setNotes] = useState("")
    const [isUpdating, setIsUpdating] = useState(false)
    const [queueingIndex, setQueueingIndex] = useState<number | null>(null)
    const [mediaActionError, setMediaActionError] = useState<string | null>(null)

    useEffect(() => {
        if (item) {
            setNotes(item.notes || "")
        }
    }, [item])
    // Keep the dialog mounted even when `item` becomes null to avoid Radix Portal cleanup races.
    const effectiveOpen = Boolean(open && item)

    const statusColors = {
        ready: "text-green-600 bg-green-50 border-green-200",
        queued: "text-blue-600 bg-blue-50 border-blue-200",
        fetching: "text-amber-600 bg-amber-50 border-amber-200",
        failed: "text-red-600 bg-red-50 border-red-200",
        published: "text-purple-600 bg-purple-50 border-purple-200",
        approved: "text-green-600 bg-green-50 border-green-200",
        generated: "text-blue-600 bg-blue-50 border-blue-200",
        none: "text-zinc-500 bg-zinc-50 border-zinc-200",
    }

    const getStatusColor = (status: string) => {
        const normalized = status.toLowerCase()
        return statusColors[normalized as keyof typeof statusColors] || statusColors.none
    }

    const handleAddTag = async () => {
        if (!newTag.trim() || !item) return
        setIsUpdating(true)
        try {
            const res = await fetch(`/api/content-items/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ addTagName: newTag.trim() }),
            })
            if (res.ok) {
                const data = await res.json()
                if (onUpdate && data.item) {
                    onUpdate(data.item)
                }
                setNewTag("")
            }
        } catch (error) {
            console.error("Failed to add tag:", error)
        } finally {
            setIsUpdating(false)
        }
    }

    const handleCopy = async (text: string) => {
        try {
            await navigator.clipboard.writeText(text)
        } catch {
            window.prompt("Copy to clipboard:", text)
        }
    }

    const handleQueueDownload = async (mediaIndex: number) => {
        if (!item) return
        setQueueingIndex(mediaIndex)
        setMediaActionError(null)
        try {
            const res = await fetch(`/api/content-items/${item.id}/media/${mediaIndex}/download`, { method: "POST" })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                throw new Error(typeof data.error === "string" ? data.error : "Failed to queue download")
            }
        } catch (e) {
            setMediaActionError(e instanceof Error ? e.message : String(e))
        } finally {
            setQueueingIndex(null)
        }
    }

    const handleSaveNotes = async () => {
        if (!item) return
        setIsUpdating(true)
        try {
            const res = await fetch(`/api/content-items/${item.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
            })
            if (res.ok) {
                const data = await res.json()
                if (onUpdate && data.item) {
                    onUpdate(data.item)
                }
            }
        } catch (error) {
            console.error("Failed to save notes:", error)
        } finally {
            setIsUpdating(false)
        }
    }

    return (
        <Sheet open={effectiveOpen} onOpenChange={(o: boolean) => !o && onClose()}>
            <SheetContent className="w-full sm:max-w-xl p-0 gap-0">
                <SheetHeader className="px-4 py-3 border-b bg-muted/20">
                    <div className="flex items-center justify-between">
                        <SheetTitle className="text-sm font-medium">
                            {t.pools.columns.content}
                        </SheetTitle>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                </SheetHeader>

                {!item ? null : (
                <>
                {/* Tabs */}
                <div className="flex border-b">
                    {[
                        { key: "content", label: t.pools.columns.content, icon: PenTool },
                        { key: "versions", label: t.rewrite.batches, icon: History },
                        { key: "logs", label: t.nav.audit, icon: Clock },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key as typeof activeTab)}
                            className={cn(
                                "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors",
                                activeTab === tab.key
                                    ? "text-foreground border-b-2 border-foreground"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            <tab.icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto">
                    {activeTab === "content" && (
                        <div className="p-4 space-y-5">
                            {/* Author & Source */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center">
                                        <User className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                    </div>
                                    <div>
                                        <div className="text-sm font-medium">@{item.authorHandle}</div>
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <Calendar className="h-3 w-3" />
                                            {format(new Date(item.createdAt), "yyyy-MM-dd HH:mm")}
                                        </div>
                                    </div>
                                </div>
                                <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground transition-colors"
                                >
                                    <ExternalLink className="h-4 w-4" strokeWidth={1.5} />
                                </a>
                            </div>

                            {/* Original Text */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    {t.rewrite.original}
                                </div>
                                <div className="text-sm leading-relaxed p-3 rounded-lg bg-muted/30 border border-border/50">
                                    {item.textOriginal}
                                </div>
                            </div>

                            {/* Media */}
                            {item.media && item.media.length > 0 && (
                                <div className="space-y-2">
                                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        {isObject(item.media[0]) && item.media[0].type === "video" ? (
                                            <Video className="h-3 w-3" />
                                        ) : (
                                            <ImageIcon className="h-3 w-3" />
                                        )}
                                        Media ({item.media.length})
                                    </div>
                                    <div className="space-y-3">
                                        {item.media.map((raw, i) => {
                                            const m = parseMediaEntry(raw)
                                            if (!m) return null

                                            const isVideo = m.type === "video"
                                            const dl = m.download
                                            const dlStatus = dl?.status ?? "unknown"

                                            return (
                                                <div key={i} className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-2">
                                                            {isVideo ? (
                                                                <Video className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                                            ) : (
                                                                <ImageIcon className="h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
                                                            )}
                                                            <div className="text-xs font-medium">
                                                                {isVideo ? "Video" : "Image"} #{i + 1}
                                                                {m.width && m.height ? (
                                                                    <span className="ml-2 text-[10px] text-muted-foreground font-mono">
                                                                        {m.width}×{m.height}
                                                                    </span>
                                                                ) : null}
                                                            </div>
                                                        </div>

                                                        {isVideo && (
                                                            <Badge variant="outline" className={cn("text-[9px]", getStatusColor(dlStatus))}>
                                                                {dlStatus}
                                                            </Badge>
                                                        )}
                                                    </div>

                                                    {isVideo ? (
                                                        <div className="space-y-2">
                                                            {m.thumbnailUrl ? (
                                                                <div className="aspect-video rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                                                                    <img
                                                                        src={m.thumbnailUrl}
                                                                        alt={m.alt || ""}
                                                                        className="w-full h-full object-cover"
                                                                    />
                                                                </div>
                                                            ) : null}
                                                            {m.directUrl && (
                                                                <div className="flex items-start gap-2">
                                                                    <div className="flex-1 min-w-0">
                                                                        <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                                                            Direct URL
                                                                        </div>
                                                                        <div className="text-[11px] font-mono break-all text-muted-foreground">
                                                                            {m.directUrl}
                                                                        </div>
                                                                    </div>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-xs shrink-0"
                                                                        onClick={() => handleCopy(m.directUrl!)}
                                                                    >
                                                                        Copy
                                                                    </Button>
                                                                </div>
                                                            )}

                                                            <div className="flex flex-wrap gap-2">
                                                                {dlStatus === "ready" ? (
                                                                    <a
                                                                        href={`/api/content-items/${item.id}/media/${i}/download`}
                                                                        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 h-7 text-xs hover:bg-muted/30"
                                                                    >
                                                                        Download
                                                                    </a>
                                                                ) : (
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        className="h-7 text-xs"
                                                                        disabled={queueingIndex === i || dlStatus === "queued"}
                                                                        onClick={() => handleQueueDownload(i)}
                                                                    >
                                                                        {queueingIndex === i ? (
                                                                            <><Loader2 className="h-3 w-3 mr-1 animate-spin" /> Queueing…</>
                                                                        ) : (
                                                                            "Download locally"
                                                                        )}
                                                                    </Button>
                                                                )}

                                                                {m.sourceUrl && (
                                                                    <a
                                                                        href={m.sourceUrl}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="inline-flex items-center justify-center rounded-md border border-border bg-background px-3 h-7 text-xs hover:bg-muted/30"
                                                                    >
                                                                        Open Tweet
                                                                    </a>
                                                                )}
                                                            </div>

                                                            {dlStatus === "skipped" && (
                                                                <div className="text-xs text-muted-foreground">
                                                                    该视频未落盘（入库时选择了 link 模式）。点击 “Download locally” 后由 worker 后台下载完成，再提供下载。
                                                                </div>
                                                            )}
                                                            {dl?.error && (
                                                                <div className="text-xs text-red-600">
                                                                    {dl.error}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="aspect-video rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center overflow-hidden">
                                                            <img
                                                                src={m.directUrl || m.sourceUrl || ""}
                                                                alt={m.alt || ""}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })}
                                        {mediaActionError && (
                                            <div className="text-xs text-red-600">
                                                {mediaActionError}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Status Badges */}
                            <div className="flex flex-wrap gap-2">
                                <Badge variant="outline" className={cn("text-[10px]", getStatusColor(item.captureStatus))}>
                                    Capture: {item.captureStatus}
                                </Badge>
                                <Badge variant="outline" className={cn("text-[10px]", getStatusColor(item.rewriteStatus))}>
                                    Rewrite: {item.rewriteStatus}
                                </Badge>
                                <Badge variant="outline" className={cn("text-[10px]", getStatusColor(item.publishStatus))}>
                                    Publish: {item.publishStatus}
                                </Badge>
                            </div>

                            {/* Tags */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Tag className="h-3 w-3" />
                                    {t.ingest.tags}
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {item.tags?.map((tag) => (
                                        <Badge key={tag.id} variant="secondary" className="text-[10px] h-5 px-2">
                                            {tag.name}
                                        </Badge>
                                    ))}
                                    <div className="flex items-center gap-1">
                                        <Input
                                            value={newTag}
                                            onChange={(e) => setNewTag(e.target.value)}
                                            placeholder="Add tag..."
                                            className="h-5 w-20 text-[10px] px-1.5 border-dashed"
                                            onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-5 w-5"
                                            onClick={handleAddTag}
                                        >
                                            <Plus className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Notes */}
                            <div className="space-y-2">
                                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                    Notes
                                </div>
                                <Textarea
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    placeholder="Add notes..."
                                    className="min-h-[80px] text-sm bg-transparent border-border/50 resize-none"
                                />
                                <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={handleSaveNotes}
                                    disabled={isUpdating || notes === (item.notes || "")}
                                >
                                    {isUpdating ? (
                                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                    ) : (
                                        <Check className="h-3 w-3 mr-1" />
                                    )}
                                    {t.common.save}
                                </Button>
                            </div>
                        </div>
                    )}

                    {activeTab === "versions" && (
                        <div className="p-4 space-y-3">
                            {!item.rewriteVersions?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <PenTool className="h-8 w-8 mx-auto mb-2 opacity-30" strokeWidth={1.5} />
                                    <p className="text-sm">{t.rewrite.noBatches}</p>
                                </div>
                            ) : (
                                item.rewriteVersions.map((version) => (
                                    <div
                                        key={version.id}
                                        className="p-3 rounded-lg border border-border/50 bg-card/30 space-y-2"
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-muted-foreground">
                                                    v{version.version}
                                                </span>
                                                <Badge
                                                    variant="outline"
                                                    className={cn("text-[9px]", getStatusColor(version.status))}
                                                >
                                                    {version.status}
                                                </Badge>
                                            </div>
                                            <span className="text-[10px] text-muted-foreground">
                                                {format(new Date(version.createdAt), "MM-dd HH:mm")}
                                            </span>
                                        </div>
                                        <p className="text-sm text-foreground/80 line-clamp-3">
                                            {version.output?.text}
                                        </p>
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {activeTab === "logs" && (
                        <div className="p-4 space-y-2">
                            {!item.auditLogs?.length ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <Clock className="h-8 w-8 mx-auto mb-2 opacity-30" strokeWidth={1.5} />
                                    <p className="text-sm">{t.audit.noLogs}</p>
                                </div>
                            ) : (
                                item.auditLogs.map((log) => (
                                    <div
                                        key={log.id}
                                        className="flex items-start gap-3 py-2 border-b border-border/30 last:border-0"
                                    >
                                        <div className="h-6 w-6 rounded-full bg-muted/50 flex items-center justify-center shrink-0">
                                            <History className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium">{log.action}</div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="border-t p-3 flex items-center gap-2">
                    <Button variant="outline" size="sm" className="flex-1 h-8 text-xs">
                        <PenTool className="h-3 w-3 mr-1.5" strokeWidth={1.5} />
                        {t.pools.actions.rewrite}
                    </Button>
                    <Button
                        size="sm"
                        className="flex-1 h-8 text-xs"
                        disabled={String(item.rewriteStatus).toUpperCase() !== "APPROVED"}
                    >
                        <Send className="h-3 w-3 mr-1.5" strokeWidth={1.5} />
                        {t.publish.post}
                    </Button>
                </div>
                </>
                )}
            </SheetContent>
        </Sheet>
    )
}
