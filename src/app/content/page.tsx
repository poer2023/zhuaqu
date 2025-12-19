"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Plus,
    Search,
    Filter,
    X,
    Loader2,
    ExternalLink,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    Send,
    PenTool,
    Heart,
    Eye,
    MessageCircle,
    Repeat,
    Trash2
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"
import { Checkbox } from "@/components/ui/checkbox"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"

interface ContentItem {
    id: string
    sourceId: string
    sourceUrl: string
    authorHandle: string
    authorName?: string
    authorAvatar?: string
    textOriginal: string
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
    poolId: string
    pool?: { id: string; name: string }
    tags?: Array<{ id: string; name: string }>
    notes?: string
    createdAt: string
    updatedAt: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rawJson?: any
    approvedRewriteVersionId?: string
}

// Wrapper component to handle Suspense for useSearchParams
function ContentPageInner() {
    const { t } = useTranslations()
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { currentWorkspace, currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

    // State
    const [items, setItems] = useState<ContentItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [isDeleting, setIsDeleting] = useState(false)
    const [isMoving, setIsMoving] = useState(false)
    const [moveTargetPoolId, setMoveTargetPoolId] = useState<string>("")
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)
    const [isBatchActionLoading, setIsBatchActionLoading] = useState(false)
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)
    const [publishComplianceConfirmed, setPublishComplianceConfirmed] = useState(false)

    // Filters from URL
    const searchQuery = searchParams.get("q") || ""
    const selectedPoolId = searchParams.get("pool") || "all"
    const statusFilter = searchParams.get("status") || "all"

    // Update URL with filters
    const updateFilters = useCallback((updates: Record<string, string | null>) => {
        const params = new URLSearchParams(searchParams.toString())
        Object.entries(updates).forEach(([key, value]) => {
            if (value && value !== "all" && value !== "") {
                params.set(key, value)
            } else {
                params.delete(key)
            }
        })
        const newUrl = params.toString() ? `${pathname}?${params}` : pathname
        router.push(newUrl, { scroll: false })
    }, [searchParams, pathname, router])

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    const fetchItems = useCallback(async () => {
        if (!currentWorkspaceId) return
        setIsLoading(true)
        try {
            const params = new URLSearchParams({ workspaceId: currentWorkspaceId, limit: "50" })
            if (selectedPoolId !== "all") params.set("poolId", selectedPoolId)
            if (searchQuery) params.set("search", searchQuery)
            if (statusFilter !== "all") params.set("statusFilter", statusFilter)

            const res = await fetch(`/api/pools/items?${params}`)
            if (res.ok) {
                const data = await res.json()
                setItems(data.items || [])
            }
        } catch (error) {
            console.error("Failed to fetch items:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspaceId, selectedPoolId, searchQuery, statusFilter])

    useEffect(() => {
        fetchItems()
    }, [fetchItems])

    // Navigate to detail page with return URL
    const handleItemClick = (item: ContentItem) => {
        const returnUrl = encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`)
        router.push(`/content/${item.id}?from=${returnUrl}`)
    }

    const _getStatusBadge = (status: string) => {
        const normalized = status?.toUpperCase() || "NONE"
        const colors: Record<string, string> = {
            READY: "bg-green-500/10 text-green-500 border-green-500/20",
            PENDING: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
            FETCHING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            FAILED: "bg-red-500/10 text-red-500 border-red-500/20",
            NONE: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
            QUEUED: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            RUNNING: "bg-blue-500/10 text-blue-500 border-blue-500/20",
            NEEDS_REVIEW: "bg-amber-500/10 text-amber-500 border-amber-500/20",
            APPROVED: "bg-green-500/10 text-green-500 border-green-500/20",
            NOT_PUBLISHED: "bg-zinc-500/10 text-zinc-500 border-zinc-500/20",
            PUBLISHED: "bg-green-500/10 text-green-500 border-green-500/20",
            SCHEDULED: "bg-purple-500/10 text-purple-500 border-purple-500/20",
        }

        const icons: Record<string, React.ReactNode> = {
            READY: <CheckCircle2 className="h-2.5 w-2.5" />,
            PENDING: <Clock className="h-2.5 w-2.5" />,
            FAILED: <AlertCircle className="h-2.5 w-2.5" />,
            APPROVED: <CheckCircle2 className="h-2.5 w-2.5" />,
            PUBLISHED: <Send className="h-2.5 w-2.5" />,
            NEEDS_REVIEW: <PenTool className="h-2.5 w-2.5" />,
        }

        return (
            <Badge
                variant="outline"
                className={cn("text-[10px] px-1.5 py-0.5 h-auto gap-1 font-medium border", colors[normalized] || colors.NONE)}
            >
                {icons[normalized]}
                {normalized.replace(/_/g, " ")}
            </Badge>
        )
    }

    const formatNumber = (num?: number) => {
        if (!num) return "0"
        if (num >= 1000000) return (num / 1000000).toFixed(1) + "M"
        if (num >= 1000) return (num / 1000).toFixed(1) + "K"
        return num.toString()
    }

    const formatDate = (dateString: string) => {
        try {
            return new Date(dateString).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                hour: 'numeric',
                minute: 'numeric',
                hour12: true
            })
        } catch {
            return ""
        }
    }

    const clearFilters = () => {
        router.push(pathname)
    }

    const hasFilters = searchQuery || selectedPoolId !== "all" || statusFilter !== "all"

    // Toggle item selection
    const toggleItemSelection = (itemId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setSelectedItems(prev => {
            const newSet = new Set(prev)
            if (newSet.has(itemId)) {
                newSet.delete(itemId)
            } else {
                newSet.add(itemId)
            }
            return newSet
        })
    }

    // Delete confirmation state
    const [deleteTarget, setDeleteTarget] = useState<{ type: 'single' | 'multi'; itemId?: string } | null>(null)

    // Initiate single item delete
    const handleDeleteItem = (itemId: string, e: React.MouseEvent) => {
        e.stopPropagation()
        e.preventDefault()
        setDeleteTarget({ type: 'single', itemId })
    }

    // Initiate batch delete
    const handleDeleteSelected = () => {
        if (selectedItems.size === 0) return
        setDeleteTarget({ type: 'multi' })
    }

    // Confirm delete action
    const confirmDelete = async () => {
        if (!deleteTarget) return
        setIsDeleting(true)

        try {
            if (deleteTarget.type === 'single' && deleteTarget.itemId) {
                const res = await fetch(`/api/content-items/${deleteTarget.itemId}`, { method: "DELETE" })
                if (res.ok) {
                    setItems(prev => prev.filter(item => item.id !== deleteTarget.itemId))
                    setSelectedItems(prev => {
                        const newSet = new Set(prev)
                        newSet.delete(deleteTarget.itemId!)
                        return newSet
                    })
                }
            } else if (deleteTarget.type === 'multi') {
                const res = await fetch("/api/pools/items", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "delete", itemIds: Array.from(selectedItems) })
                })
                if (res.ok) {
                    setItems(prev => prev.filter(item => !selectedItems.has(item.id)))
                    setSelectedItems(new Set())
                }
            }
        } catch (error) {
            console.error("Failed to delete:", error)
        } finally {
            setIsDeleting(false)
            setDeleteTarget(null)
        }
    }

    // Batch Move
    const handleMoveSelected = () => {
        setMoveTargetPoolId("")
        setMoveDialogOpen(true)
    }

    const confirmMove = async () => {
        if (!moveTargetPoolId || selectedItems.size === 0) return
        setIsMoving(true)
        try {
            const res = await fetch("/api/pools/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "move",
                    itemIds: Array.from(selectedItems),
                    data: { poolId: moveTargetPoolId }
                })
            })
            if (res.ok) {
                // If we are filtering by pool, remove moved items from view
                if (selectedPoolId !== "all" && selectedPoolId !== moveTargetPoolId) {
                    setItems(prev => prev.filter(item => !selectedItems.has(item.id)))
                } else {
                    // Update pool info locally
                    const targetPool = currentWorkspace?.pools.find(p => p.id === moveTargetPoolId)
                    setItems(prev => prev.map(item => {
                        if (selectedItems.has(item.id)) {
                            return { ...item, poolId: moveTargetPoolId, pool: targetPool ? { id: targetPool.id, name: targetPool.name } : item.pool }
                        }
                        return item
                    }))
                }
                setSelectedItems(new Set())
                setMoveDialogOpen(false)
            }
        } catch (error) {
            console.error("Failed to move items:", error)
        } finally {
            setIsMoving(false)
        }
    }

    // Batch Rewrite
    const handleRewriteSelected = async () => {
        if (selectedItems.size === 0) return
        setIsBatchActionLoading(true)
        try {
            const res = await fetch("/api/rewrite/batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    itemIds: Array.from(selectedItems),
                    name: `Batch Rewrite ${new Date().toLocaleDateString()}`
                })
            })
            if (res.ok) {
                const data = await res.json()
                if (data.batch?.id) {
                    router.push(`/rewrite?batchId=${data.batch.id}`)
                }
            }
        } catch (error) {
            console.error("Failed to create rewrite batch:", error)
        } finally {
            setIsBatchActionLoading(false)
        }
    }

    // Batch Publish (Add to Queue)
    const handlePublishSelected = async () => {
        if (selectedItems.size === 0) return

        // Filter items that have approved rewrite versions
        const itemsToPublish = items.filter(i => selectedItems.has(i.id) && i.approvedRewriteVersionId)

        if (itemsToPublish.length === 0) {
            alert("选中的条目中没有已通过改写内容的内容 (Approved Rewrite)。")
            return
        }

        // Open the compliance confirmation dialog
        setPublishComplianceConfirmed(false)
        setPublishDialogOpen(true)
    }

    const confirmBatchPublish = async () => {
        if (!publishComplianceConfirmed) return
        const itemsToPublish = items.filter(i => selectedItems.has(i.id) && i.approvedRewriteVersionId)

        setIsBatchActionLoading(true)
        setPublishDialogOpen(false)
        try {
            const rewriteVersionIds = itemsToPublish.map(i => i.approvedRewriteVersionId!)

            await fetch("/api/publish/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    rewriteVersionIds,
                    mode: "single",
                    complianceConfirmed: true
                })
            })

            fetchItems()
            setSelectedItems(new Set())
            router.push("/publish")
        } catch (error) {
            console.error("Failed to batch publish:", error)
        } finally {
            setIsBatchActionLoading(false)
        }
    }

    return (
        <PageShell
            title={
                <div className="flex items-center gap-2">
                    {t.nav.content}
                    {!isLoading && items.length > 0 && (
                        <span className="text-sm font-normal text-muted-foreground bg-accent/50 px-2 py-0.5 rounded-full">
                            {items.length}
                        </span>
                    )}
                </div>
            }
            description="Manage your content items"
            headerAction={
                <Button asChild className="h-9 px-4">
                    <Link href="/content/ingest">
                        <Plus className="mr-2 h-4 w-4" />
                        Ingest
                    </Link>
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-background/50 sticky top-0 z-10 backdrop-blur-sm">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="Search content, author, URL..."
                            defaultValue={searchQuery}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    updateFilters({ q: e.currentTarget.value })
                                }
                            }}
                            className="pl-9 h-9"
                        />
                    </div>

                    <Select value={selectedPoolId} onValueChange={(v) => updateFilters({ pool: v })}>
                        <SelectTrigger className="w-[160px] h-9">
                            <SelectValue placeholder="All Pools" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Pools</SelectItem>
                            {currentWorkspace?.pools?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    <Select value={statusFilter} onValueChange={(v) => updateFilters({ status: v })}>
                        <SelectTrigger className="w-[140px] h-9">
                            <Filter className="h-3.5 w-3.5 mr-2" />
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Status</SelectItem>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="rewrite_pending">Rewrite Pending</SelectItem>
                            <SelectItem value="publish_pending">Publish Pending</SelectItem>
                            <SelectItem value="published">Published</SelectItem>
                        </SelectContent>
                    </Select>

                    {hasFilters && (
                        <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9">
                            <X className="h-4 w-4 mr-1" />
                            Clear
                        </Button>
                    )}

                    <Button variant="ghost" size="icon" onClick={() => fetchItems()} className="h-9 w-9">
                        <RefreshCw className="h-4 w-4" />
                    </Button>
                </div>

                {/* Content Waterfall */}
                {isLoading ? (
                    <div className="p-24 text-center">
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    </div>
                ) : items.length === 0 ? (
                    <div className="p-24 text-center border rounded-lg border-dashed bg-accent/10">
                        <div className="bg-background w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 border shadow-sm">
                            <Search className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                        <h3 className="text-lg font-medium mb-1">No content found</h3>
                        <p className="text-sm text-muted-foreground mb-4">Try adjusting your filters or ingest new content</p>
                        <Button variant="outline" size="sm" asChild>
                            <Link href="/content/ingest">
                                <Plus className="h-4 w-4 mr-2" />
                                Start Ingesting
                            </Link>
                        </Button>
                    </div>
                ) : (
                    <>
                        {/* Bulk action bar */}
                        {selectedItems.size > 0 && (
                            <div className="mb-4 p-3 bg-accent/50 rounded-lg border flex items-center justify-between">
                                <div className="text-sm font-medium">
                                    已选中 {selectedItems.size} 项
                                </div>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleMoveSelected}
                                        disabled={isMoving || isBatchActionLoading}
                                    >
                                        <Repeat className="h-4 w-4 mr-2" />
                                        移动至...
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleRewriteSelected}
                                        disabled={isMoving || isBatchActionLoading}
                                    >
                                        <PenTool className="h-4 w-4 mr-2" />
                                        批量改写
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handlePublishSelected}
                                        disabled={isMoving || isBatchActionLoading}
                                    >
                                        <Send className="h-4 w-4 mr-2" />
                                        批量发布
                                    </Button>
                                    <div className="w-px h-6 bg-border mx-1"></div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedItems(new Set())}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        variant="destructive"
                                        size="sm"
                                        onClick={handleDeleteSelected}
                                        disabled={isDeleting || isMoving || isBatchActionLoading}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        )}
                        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
                            {items.map((item) => {
                                // rawJson can be X GraphQL response or yt-dlp output
                                const rawJson = item.rawJson || {}

                                /* eslint-disable @typescript-eslint/no-explicit-any */
                                // Try X GraphQL structure: data.tweetResult.result.legacy
                                const graphqlLegacy = (rawJson as any)?.data?.tweetResult?.result?.legacy ||
                                    (rawJson as any)?.data?.tweetResult?.result?.tweet?.legacy || {}
                                const graphqlResult = (rawJson as any)?.data?.tweetResult?.result ||
                                    (rawJson as any)?.data?.tweetResult?.result?.tweet || {}

                                // Also check yt-dlp structure which has flat fields
                                const ytdlp = rawJson as any

                                // Extract counts with fallbacks
                                const likeCount = graphqlLegacy.favorite_count ?? ytdlp.like_count ?? ytdlp.favorite_count ?? 0
                                const replyCount = graphqlLegacy.reply_count ?? ytdlp.reply_count ?? 0
                                const _repostCount = graphqlLegacy.retweet_count ?? graphqlLegacy.quote_count ?? ytdlp.repost_count ?? ytdlp.retweet_count ?? 0
                                const viewCount = graphqlResult.views?.count ?? ytdlp.view_count ?? 0

                                // Author info
                                const graphqlUser = (rawJson as any)?.data?.tweetResult?.result?.core?.user_results?.result?.legacy ||
                                    (rawJson as any)?.data?.tweetResult?.result?.tweet?.core?.user_results?.result?.legacy || {}
                                /* eslint-enable @typescript-eslint/no-explicit-any */
                                const authorAvatar = item.authorAvatar || graphqlUser.profile_image_url_https || ytdlp.uploader_url
                                const authorName = item.authorName || graphqlUser.name || ytdlp.uploader || item.authorHandle
                                const createdTime = graphqlLegacy.created_at || ytdlp.timestamp || item.createdAt

                                return (
                                    <div
                                        key={item.id}
                                        className="break-inside-avoid bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer flex flex-col"
                                        onClick={() => handleItemClick(item)}
                                    >
                                        {/* Author & Header */}
                                        <div className="p-4 pb-2 flex justify-between items-start gap-2">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <div className="w-9 h-9 rounded-full bg-accent/50 overflow-hidden flex-shrink-0 border">
                                                    {authorAvatar ? (
                                                        <img
                                                            src={authorAvatar}
                                                            alt={authorName}
                                                            className="w-full h-full object-cover"
                                                            referrerPolicy="no-referrer"
                                                        />
                                                    ) : (
                                                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground">
                                                            {item.authorHandle.charAt(0).toUpperCase()}
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="flex flex-col min-w-0">
                                                    <span className="text-sm font-semibold truncate flex items-center gap-1">
                                                        {authorName}
                                                        {/* Verified badge simulation if needed */}
                                                    </span>
                                                    <span className="text-xs text-muted-foreground truncate">@{item.authorHandle}</span>
                                                </div>
                                            </div>
                                            <div className="flex gap-1 flex-shrink-0">
                                                {item.pool && (
                                                    <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal bg-accent/50 text-muted-foreground">
                                                        {item.pool.name}
                                                    </Badge>
                                                )}
                                                <a
                                                    href={item.sourceUrl}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="text-muted-foreground hover:text-foreground p-1"
                                                >
                                                    <ExternalLink className="h-3.5 w-3.5" />
                                                </a>
                                            </div>
                                        </div>

                                        {/* Text Content */}
                                        <div className="px-4 py-2">
                                            <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90 font-normal">
                                                {item.textOriginal}
                                            </p>
                                        </div>

                                        {/* Media Grid */}
                                        {(() => {
                                            // Extract media from multiple sources
                                            let mediaItems: Array<{ type: string; url: string; thumbnailUrl?: string }> = []

                                            // From item.media field
                                            if (item.media && Array.isArray(item.media) && item.media.length > 0) {
                                                mediaItems = item.media.map((m) => {
                                                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                                    const media = m as any
                                                    const imageUrl = media.directUrl || media.thumbnailUrl || media.sourceUrl || ''
                                                    return {
                                                        type: media.type || 'image',
                                                        url: imageUrl,
                                                        thumbnailUrl: media.thumbnailUrl || media.directUrl || media.sourceUrl
                                                    }
                                                }).filter(m => m.url)
                                            }

                                            // Fallback: from rawJson.extended_entities or entities
                                            if (mediaItems.length === 0 && item.rawJson) {
                                                const extMedia = item.rawJson.extended_entities?.media || item.rawJson.entities?.media || []
                                                if (Array.isArray(extMedia)) {
                                                    mediaItems = extMedia.map((m: { type?: string; media_url_https?: string; video_info?: { variants?: Array<{ url?: string }> } }) => ({
                                                        type: m.type === 'video' || m.type === 'animated_gif' ? 'video' : 'image',
                                                        url: m.media_url_https || '',
                                                        thumbnailUrl: m.media_url_https
                                                    })).filter((m: { url: string }) => m.url)
                                                }
                                            }

                                            if (mediaItems.length === 0) return null

                                            return (
                                                <div className={cn(
                                                    "mt-2 grid gap-0.5 overflow-hidden",
                                                    mediaItems.length === 1 ? "grid-cols-1" :
                                                        mediaItems.length === 2 ? "grid-cols-2" :
                                                            mediaItems.length === 3 ? "grid-cols-2" : "grid-cols-2"
                                                )}>
                                                    {mediaItems.slice(0, 4).map((m, idx) => (
                                                        <div
                                                            key={idx}
                                                            className={cn(
                                                                "relative bg-accent/20 overflow-hidden",
                                                                mediaItems.length === 3 && idx === 0 ? "row-span-2" : "",
                                                                mediaItems.length === 1 ? "max-h-80" : "aspect-[4/3]"
                                                            )}
                                                        >
                                                            {m.type === 'video' ? (
                                                                <div className="relative w-full h-full">
                                                                    <img
                                                                        src={m.thumbnailUrl || m.url}
                                                                        alt=""
                                                                        className="w-full h-full object-cover"
                                                                        loading="lazy"
                                                                        referrerPolicy="no-referrer"
                                                                    />
                                                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                                                                        <div className="w-12 h-12 rounded-full bg-black/60 flex items-center justify-center">
                                                                            <div className="w-0 h-0 border-t-[8px] border-t-transparent border-l-[14px] border-l-white border-b-[8px] border-b-transparent ml-1" />
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <img
                                                                    src={m.url}
                                                                    alt=""
                                                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                                                    loading="lazy"
                                                                    referrerPolicy="no-referrer"
                                                                    onError={(e) => {
                                                                        e.currentTarget.style.display = 'none';
                                                                        e.currentTarget.parentElement?.classList.add('hidden');
                                                                    }}
                                                                />
                                                            )}
                                                        </div>
                                                    ))}
                                                    {mediaItems.length > 4 && (
                                                        <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full font-medium">
                                                            +{mediaItems.length - 4}
                                                        </div>
                                                    )}
                                                </div>
                                            )
                                        })()}

                                        {/* Footer */}
                                        <div className="p-4 pt-3 flex flex-col gap-2">
                                            {/* Time and source */}
                                            <div className="text-[11px] text-muted-foreground/70 font-medium">
                                                {formatDate(createdTime)}
                                                {item.sourceUrl.includes("x.com") || item.sourceUrl.includes("twitter.com") ? " · X" : ""}
                                            </div>

                                            {/* Actions row with stats */}
                                            <div className="flex items-center justify-between pt-2 border-t border-border/40">
                                                {/* Left: Checkbox + Stats */}
                                                <div className="flex items-center gap-3">
                                                    <div onClick={(e) => toggleItemSelection(item.id, e)}>
                                                        <Checkbox
                                                            checked={selectedItems.has(item.id)}
                                                            className="h-4 w-4"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-3 text-muted-foreground">
                                                        <div className="flex items-center gap-1 text-xs">
                                                            <Heart className={cn("h-3.5 w-3.5", likeCount > 0 && "fill-current text-pink-500")} />
                                                            <span>{formatNumber(likeCount)}</span>
                                                        </div>
                                                        {replyCount > 0 && (
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <MessageCircle className="h-3.5 w-3.5" />
                                                                <span>{formatNumber(replyCount)}</span>
                                                            </div>
                                                        )}
                                                        {viewCount > 0 && (
                                                            <div className="flex items-center gap-1 text-xs">
                                                                <Eye className="h-3.5 w-3.5" />
                                                                <span>{formatNumber(viewCount)}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Right: Actions */}
                                                <div className="flex gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/content/${item.id}/rewrite`)
                                                        }}
                                                        title="Rewrite"
                                                    >
                                                        <PenTool className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7"
                                                        onClick={(e) => {
                                                            e.stopPropagation()
                                                            router.push(`/content/${item.id}/publish`)
                                                        }}
                                                        title="Publish"
                                                    >
                                                        <Send className="h-3.5 w-3.5" />
                                                    </Button>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                                        onClick={(e) => handleDeleteItem(item.id, e)}
                                                        title="Delete"
                                                        disabled={isDeleting}
                                                    >
                                                        <Trash2 className="h-3.5 w-3.5" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </>
                )}
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteTarget !== null} onOpenChange={(open) => !open && setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            {deleteTarget?.type === 'single'
                                ? "确定要删除这条内容吗？此操作无法撤销。"
                                : `确定要删除选中的 ${selectedItems.size} 条内容吗？此操作无法撤销。`
                            }
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>取消</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={confirmDelete}
                            disabled={isDeleting}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            删除
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Move Dialog */}
            <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>移动至素材池</DialogTitle>
                        <DialogDescription>
                            将选中的 {selectedItems.size} 条内容移动到指定素材池。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Label className="mb-2 block">选择目标素材池</Label>
                        <Select value={moveTargetPoolId} onValueChange={setMoveTargetPoolId}>
                            <SelectTrigger>
                                <SelectValue placeholder="选择素材池..." />
                            </SelectTrigger>
                            <SelectContent>
                                {currentWorkspace?.pools?.map(p => (
                                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setMoveDialogOpen(false)}>取消</Button>
                        <Button onClick={confirmMove} disabled={!moveTargetPoolId || isMoving}>
                            {isMoving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            确认移动
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Batch Publish Compliance Dialog */}
            <Dialog open={publishDialogOpen} onOpenChange={setPublishDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>批量发布确认</DialogTitle>
                        <DialogDescription>
                            准备将 {items.filter(i => selectedItems.has(i.id) && i.approvedRewriteVersionId).length} 条已审核内容加入发布队列。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${publishComplianceConfirmed
                            ? "bg-green-50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30"
                            : "bg-muted/20"
                            }`}>
                            <Checkbox
                                id="batch-compliance"
                                checked={publishComplianceConfirmed}
                                onCheckedChange={(c) => setPublishComplianceConfirmed(c === true)}
                                className="mt-0.5"
                            />
                            <label
                                htmlFor="batch-compliance"
                                className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                            >
                                我已确认选中的所有内容均符合平台规范，不含敏感信息、侵权内容或违规言论，且已获得必要授权进行发布。
                            </label>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setPublishDialogOpen(false)}>取消</Button>
                        <Button onClick={confirmBatchPublish} disabled={!publishComplianceConfirmed || isBatchActionLoading}>
                            {isBatchActionLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            确认发布
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}

// Default export with Suspense boundary
export default function ContentPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></div>}>
            <ContentPageInner />
        </Suspense>
    )
}
