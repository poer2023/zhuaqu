"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    ExternalLink,
    User,
    Calendar,
    Video,
    Image as ImageIcon,
    Tag,
    FileText,
    PenTool,
    Send,
    CheckCircle2,
    AlertCircle,
    Clock,
    Loader2,
    Plus,
    Check,
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
        directUrl?: string
        thumbnailUrl?: string
        localPath?: string
        width?: number
        height?: number
    }>
    captureStatus: string
    rewriteStatus: string
    publishStatus: string
    pool?: { id: string; name: string }
    tags?: Array<{ id: string; name: string }>
    notes?: string
    createdAt: string
    updatedAt: string
}

// Workflow step component
function WorkflowStep({
    label,
    status,
    isActive,
    isCompleted,
}: {
    label: string
    status: string
    isActive: boolean
    isCompleted: boolean
}) {
    return (
        <div className="flex flex-col items-center gap-1">
            <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all",
                isCompleted ? "bg-green-500 border-green-500 text-white" :
                    isActive ? "bg-primary border-primary text-primary-foreground" :
                        "bg-muted border-border text-muted-foreground"
            )}>
                {isCompleted ? (
                    <CheckCircle2 className="h-4 w-4" />
                ) : isActive ? (
                    <Clock className="h-4 w-4" />
                ) : (
                    <div className="w-2 h-2 rounded-full bg-current" />
                )}
            </div>
            <div className="text-center">
                <div className={cn(
                    "text-xs font-medium",
                    isActive || isCompleted ? "text-foreground" : "text-muted-foreground"
                )}>{label}</div>
                <div className={cn(
                    "text-[10px]",
                    status === "FAILED" ? "text-red-500" : "text-muted-foreground"
                )}>{status}</div>
            </div>
        </div>
    )
}

export default function ContentDetailPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const { t } = useTranslations()
    const router = useRouter()
    const searchParams = useSearchParams()

    const [item, setItem] = useState<ContentItem | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [notes, setNotes] = useState("")
    const [newTag, setNewTag] = useState("")
    const [isSaving, setIsSaving] = useState(false)

    // Get return URL from search params
    const returnUrl = searchParams.get("from") || "/content"

    const fetchItem = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/content-items/${id}`)
            if (res.ok) {
                const data = await res.json()
                setItem(data.item)
                setNotes(data.item?.notes || "")
            }
        } catch (error) {
            console.error("Failed to fetch item:", error)
        } finally {
            setIsLoading(false)
        }
    }, [id])

    useEffect(() => {
        fetchItem()
    }, [fetchItem])

    const handleSaveNotes = async () => {
        if (!item) return
        setIsSaving(true)
        try {
            await fetch(`/api/content-items/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ notes }),
            })
        } finally {
            setIsSaving(false)
        }
    }

    const handleAddTag = async () => {
        if (!newTag.trim() || !item) return
        // TODO: Implement add tag API
        setNewTag("")
    }

    // Determine workflow status
    const captureReady = item?.captureStatus?.toUpperCase() === "READY"
    const rewriteApproved = item?.rewriteStatus?.toUpperCase() === "APPROVED"
    const published = item?.publishStatus?.toUpperCase() === "PUBLISHED"
    const rewriteNeedsReview = item?.rewriteStatus?.toUpperCase() === "NEEDS_REVIEW"

    // Primary action based on status
    const getPrimaryAction = () => {
        if (!item) return null

        const captureFailed = item.captureStatus?.toUpperCase() === "FAILED"
        const rewriteFailed = item.rewriteStatus?.toUpperCase() === "FAILED"
        const publishFailed = item.publishStatus?.toUpperCase() === "FAILED"

        if (captureFailed || rewriteFailed || publishFailed) {
            return (
                <Button variant="destructive" size="sm">
                    <AlertCircle className="h-4 w-4 mr-2" />
                    重试
                </Button>
            )
        }

        if (captureReady && !rewriteApproved && !rewriteNeedsReview) {
            return (
                <Button asChild size="sm">
                    <Link href={`/content/${id}/rewrite`}>
                        <PenTool className="h-4 w-4 mr-2" />
                        开始改写
                    </Link>
                </Button>
            )
        }

        if (rewriteNeedsReview) {
            return (
                <div className="flex gap-2">
                    <Button variant="outline" size="sm">驳回</Button>
                    <Button size="sm">
                        <Check className="h-4 w-4 mr-2" />
                        通过
                    </Button>
                </div>
            )
        }

        if (rewriteApproved && !published) {
            return (
                <Button asChild size="sm">
                    <Link href={`/content/${id}/publish`}>
                        <Send className="h-4 w-4 mr-2" />
                        发布
                    </Link>
                </Button>
            )
        }

        return null
    }

    if (isLoading) {
        return (
            <PageShell title="Loading...">
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </PageShell>
        )
    }

    if (!item) {
        return (
            <PageShell title="Not Found">
                <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                    <FileText className="h-12 w-12 mb-4 opacity-40" />
                    <p>Content item not found</p>
                    <Button variant="outline" className="mt-4" onClick={() => router.push("/content")}>
                        返回列表
                    </Button>
                </div>
            </PageShell>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
                <div className="max-w-6xl mx-auto px-6 py-3">
                    {/* Top row: Navigation + Actions */}
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={returnUrl}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    返回列表
                                </Link>
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <User className="h-3.5 w-3.5" />
                                <span className="font-medium">@{item.authorHandle}</span>
                                <span>·</span>
                                <Calendar className="h-3.5 w-3.5" />
                                <span>{format(new Date(item.updatedAt), "MM/dd HH:mm")}</span>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {/* Prev/Next navigation */}
                            <div className="flex items-center gap-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <Button variant="outline" size="icon" className="h-8 w-8" disabled>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            {getPrimaryAction()}
                        </div>
                    </div>

                    {/* Workflow Stepper */}
                    <div className="flex items-center justify-center gap-8">
                        <WorkflowStep
                            label="Capture"
                            status={item.captureStatus}
                            isActive={!captureReady}
                            isCompleted={captureReady}
                        />
                        <div className={cn(
                            "flex-1 h-0.5 max-w-[100px]",
                            captureReady ? "bg-green-500" : "bg-border"
                        )} />
                        <WorkflowStep
                            label="Rewrite"
                            status={item.rewriteStatus || "NONE"}
                            isActive={captureReady && !rewriteApproved}
                            isCompleted={rewriteApproved}
                        />
                        <div className={cn(
                            "flex-1 h-0.5 max-w-[100px]",
                            rewriteApproved ? "bg-green-500" : "bg-border"
                        )} />
                        <WorkflowStep
                            label="Publish"
                            status={item.publishStatus || "NOT_PUBLISHED"}
                            isActive={rewriteApproved && !published}
                            isCompleted={published}
                        />
                    </div>
                </div>
            </div>

            {/* Main Content - 2 columns */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="grid lg:grid-cols-5 gap-6">
                    {/* Left Column - Main Content (60%) */}
                    <div className="lg:col-span-3 space-y-6">
                        {/* Original Text */}
                        <div className="rounded-lg border bg-card p-5 space-y-3">
                            <div className="flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    原文内容
                                </Label>
                                <a
                                    href={item.sourceUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                    查看源
                                </a>
                            </div>
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                {item.textOriginal}
                            </div>
                        </div>

                        {/* Media */}
                        {item.media && item.media.length > 0 && (
                            <div className="rounded-lg border bg-card p-5 space-y-3">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    {item.media[0]?.type === "video" ? (
                                        <Video className="h-3 w-3" />
                                    ) : (
                                        <ImageIcon className="h-3 w-3" />
                                    )}
                                    媒体 ({item.media.length})
                                </Label>
                                <div className="grid grid-cols-2 gap-3">
                                    {item.media.map((m, i) => (
                                        <div
                                            key={i}
                                            className="aspect-video rounded-lg bg-muted/50 border flex items-center justify-center overflow-hidden"
                                        >
                                            {m.type === "video" ? (
                                                m.thumbnailUrl ? (
                                                    <div className="relative w-full h-full">
                                                        <img
                                                            src={m.thumbnailUrl}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                        />
                                                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                            <Video className="h-8 w-8 text-white" strokeWidth={1.5} />
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                                                        <Video className="h-8 w-8" strokeWidth={1.5} />
                                                        <span className="text-xs">Video</span>
                                                        {m.width && m.height && (
                                                            <span className="text-[10px] font-mono">{m.width}×{m.height}</span>
                                                        )}
                                                    </div>
                                                )
                                            ) : (
                                                <img
                                                    src={m.directUrl || m.sourceUrl}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                />
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Meta Info (40%) */}
                    <div className="lg:col-span-2 space-y-5">
                        {/* Pool */}
                        <div className="rounded-lg border bg-card p-4 space-y-2">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Pool
                            </Label>
                            <Badge variant="secondary" className="text-sm">
                                {item.pool?.name || "Unknown"}
                            </Badge>
                        </div>

                        {/* Tags */}
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Tag className="h-3 w-3" />
                                Tags
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                                {item.tags?.map((tag) => (
                                    <Badge key={tag.id} variant="outline" className="text-xs">
                                        {tag.name}
                                    </Badge>
                                ))}
                                <div className="flex items-center gap-1">
                                    <Input
                                        value={newTag}
                                        onChange={(e) => setNewTag(e.target.value)}
                                        placeholder="添加标签..."
                                        className="h-6 w-24 text-xs px-2 border-dashed"
                                        onKeyDown={(e) => e.key === "Enter" && handleAddTag()}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={handleAddTag}
                                    >
                                        <Plus className="h-3 w-3" />
                                    </Button>
                                </div>
                            </div>
                        </div>

                        {/* Notes */}
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                Notes
                            </Label>
                            <Textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="添加备注..."
                                className="min-h-[100px] text-sm resize-none"
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={handleSaveNotes}
                                disabled={isSaving || notes === (item.notes || "")}
                            >
                                {isSaving ? (
                                    <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                    <Check className="h-3 w-3 mr-1" />
                                )}
                                保存
                            </Button>
                        </div>

                        {/* Quick Actions */}
                        <div className="rounded-lg border bg-card p-4 space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                操作
                            </Label>
                            <div className="space-y-2">
                                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                                    <Link href={`/content/${id}/rewrite`}>
                                        <PenTool className="h-4 w-4 mr-2" />
                                        改写
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                                    <Link href={`/content/${id}/publish`}>
                                        <Send className="h-4 w-4 mr-2" />
                                        发布
                                    </Link>
                                </Button>
                                <Button variant="outline" size="sm" className="w-full justify-start" asChild>
                                    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="h-4 w-4 mr-2" />
                                        查看源
                                    </a>
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
