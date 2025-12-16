"use client"

import { useEffect, useState, useCallback, Suspense } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Plus,
    Search,
    Filter,
    X,
    Loader2,
    MoreHorizontal,
    ExternalLink,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    FileText,
    Send,
    PenTool,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"

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
}

interface StatsData {
    pending: number
    pendingRewrite: number
    pendingPublish: number
    published: number
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
    const [stats, setStats] = useState<StatsData>({ pending: 0, pendingRewrite: 0, pendingPublish: 0, published: 0 })
    const [isLoading, setIsLoading] = useState(true)
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())

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
            const params = new URLSearchParams({ workspaceId: currentWorkspaceId })
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

    const fetchStats = useCallback(async () => {
        if (!currentWorkspaceId) return
        try {
            const res = await fetch(`/api/dashboard/stats?workspaceId=${currentWorkspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setStats({
                    pending: data.stats?.queued || 0,
                    pendingRewrite: data.stats?.pendingRewrite || 0,
                    pendingPublish: data.stats?.published || 0,
                    published: data.stats?.published || 0,
                })
            }
        } catch (error) {
            console.error("Failed to fetch stats:", error)
        }
    }, [currentWorkspaceId])

    useEffect(() => {
        fetchItems()
        fetchStats()
    }, [fetchItems, fetchStats])

    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedItems(new Set(items.map(i => i.id)))
        } else {
            setSelectedItems(new Set())
        }
    }

    const handleSelectItem = (id: string, checked: boolean) => {
        const next = new Set(selectedItems)
        if (checked) {
            next.add(id)
        } else {
            next.delete(id)
        }
        setSelectedItems(next)
    }

    // Navigate to detail page with return URL
    const handleItemClick = (item: ContentItem) => {
        const returnUrl = encodeURIComponent(`${pathname}${searchParams.toString() ? `?${searchParams}` : ""}`)
        router.push(`/content/${item.id}?from=${returnUrl}`)
    }

    const getStatusBadge = (status: string, type: "capture" | "rewrite" | "publish") => {
        const normalized = status?.toUpperCase() || "NONE"
        const colors: Record<string, string> = {
            READY: "bg-green-100 text-green-700 border-green-200",
            PENDING: "bg-yellow-100 text-yellow-700 border-yellow-200",
            FETCHING: "bg-blue-100 text-blue-700 border-blue-200",
            FAILED: "bg-red-100 text-red-700 border-red-200",
            NONE: "bg-zinc-100 text-zinc-600 border-zinc-200",
            QUEUED: "bg-blue-100 text-blue-700 border-blue-200",
            RUNNING: "bg-blue-100 text-blue-700 border-blue-200",
            NEEDS_REVIEW: "bg-amber-100 text-amber-700 border-amber-200",
            APPROVED: "bg-green-100 text-green-700 border-green-200",
            NOT_PUBLISHED: "bg-zinc-100 text-zinc-600 border-zinc-200",
            PUBLISHED: "bg-green-100 text-green-700 border-green-200",
            SCHEDULED: "bg-purple-100 text-purple-700 border-purple-200",
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
                className={cn("text-[9px] px-1.5 py-0 h-4 gap-0.5 font-medium", colors[normalized] || colors.NONE)}
            >
                {icons[normalized]}
                {normalized.replace(/_/g, " ")}
            </Badge>
        )
    }

    const clearFilters = () => {
        router.push(pathname)
    }

    const hasFilters = searchQuery || selectedPoolId !== "all" || statusFilter !== "all"

    return (
        <PageShell
            title={t.nav.content}
            description="管理所有内容条目"
            headerAction={
                <Button asChild className="h-9 px-4">
                    <Link href="/content/ingest">
                        <Plus className="mr-2 h-4 w-4" />
                        采集/入库
                    </Link>
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <button
                        onClick={() => updateFilters({ status: "pending" })}
                        className={cn(
                            "p-4 rounded-lg border text-left transition-all hover:border-foreground/20",
                            statusFilter === "pending" ? "border-foreground/30 bg-accent" : "bg-background/50"
                        )}
                    >
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">待处理</div>
                        <div className="text-2xl font-semibold">{stats.pending}</div>
                    </button>
                    <button
                        onClick={() => updateFilters({ status: "rewrite_pending" })}
                        className={cn(
                            "p-4 rounded-lg border text-left transition-all hover:border-foreground/20",
                            statusFilter === "rewrite_pending" ? "border-foreground/30 bg-accent" : "bg-background/50"
                        )}
                    >
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">待改写</div>
                        <div className="text-2xl font-semibold">{stats.pendingRewrite}</div>
                    </button>
                    <button
                        onClick={() => updateFilters({ status: "publish_pending" })}
                        className={cn(
                            "p-4 rounded-lg border text-left transition-all hover:border-foreground/20",
                            statusFilter === "publish_pending" ? "border-foreground/30 bg-accent" : "bg-background/50"
                        )}
                    >
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">待发布</div>
                        <div className="text-2xl font-semibold">{stats.pendingPublish}</div>
                    </button>
                    <button
                        onClick={() => updateFilters({ status: "published" })}
                        className={cn(
                            "p-4 rounded-lg border text-left transition-all hover:border-foreground/20",
                            statusFilter === "published" ? "border-foreground/30 bg-accent" : "bg-background/50"
                        )}
                    >
                        <div className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-1">已发布</div>
                        <div className="text-2xl font-semibold">{stats.published}</div>
                    </button>
                </div>

                {/* Filter Bar */}
                <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-background/50 sticky top-0 z-10">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="搜索内容、作者、URL..."
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
                            <SelectItem value="pending">待处理</SelectItem>
                            <SelectItem value="rewrite_pending">待改写</SelectItem>
                            <SelectItem value="publish_pending">待发布</SelectItem>
                            <SelectItem value="published">已发布</SelectItem>
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

                {/* Bulk Action Bar */}
                {selectedItems.size > 0 && (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-accent animate-in slide-in-from-top-2">
                        <span className="text-sm font-medium">{selectedItems.size} selected</span>
                        <div className="flex-1" />
                        <Button variant="outline" size="sm">Add Tags</Button>
                        <Button variant="outline" size="sm">Change Pool</Button>
                        <Button variant="outline" size="sm">
                            <PenTool className="h-3.5 w-3.5 mr-1.5" />
                            Rewrite
                        </Button>
                        <Button variant="outline" size="sm">
                            <Send className="h-3.5 w-3.5 mr-1.5" />
                            Queue Publish
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSelectedItems(new Set())}>
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                {/* Content List */}
                <div className="rounded-lg border overflow-hidden">
                    {/* Header */}
                    <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-2 bg-muted/30 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        <Checkbox
                            checked={items.length > 0 && selectedItems.size === items.length}
                            onCheckedChange={handleSelectAll}
                        />
                        <span>Content</span>
                        <span className="text-center w-[200px]">Status</span>
                        <span className="text-center w-[100px]">Updated</span>
                        <span className="w-8" />
                    </div>

                    {/* Items */}
                    {isLoading ? (
                        <div className="p-12 text-center">
                            <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="p-12 text-center text-muted-foreground">
                            <FileText className="h-8 w-8 mx-auto mb-3 opacity-40" />
                            <p className="text-sm">No content items found</p>
                            <Button variant="outline" size="sm" className="mt-4" asChild>
                                <Link href="/content/ingest">
                                    <Plus className="h-4 w-4 mr-2" />
                                    Start capturing
                                </Link>
                            </Button>
                        </div>
                    ) : (
                        <div className="divide-y">
                            {items.map((item) => (
                                <div
                                    key={item.id}
                                    className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 px-4 py-3 hover:bg-accent/50 transition-colors cursor-pointer items-center"
                                    onClick={() => handleItemClick(item)}
                                >
                                    <Checkbox
                                        checked={selectedItems.has(item.id)}
                                        onCheckedChange={(checked) => handleSelectItem(item.id, !!checked)}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-xs font-medium text-muted-foreground">@{item.authorHandle}</span>
                                            {item.pool && (
                                                <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                                                    {item.pool.name}
                                                </Badge>
                                            )}
                                        </div>
                                        <p className="text-sm line-clamp-2">{item.textOriginal}</p>
                                    </div>
                                    <div className="flex gap-1 w-[200px] justify-center">
                                        {getStatusBadge(item.captureStatus, "capture")}
                                        {getStatusBadge(item.rewriteStatus, "rewrite")}
                                        {getStatusBadge(item.publishStatus, "publish")}
                                    </div>
                                    <div className="text-xs text-muted-foreground w-[100px] text-center">
                                        {new Date(item.updatedAt).toLocaleDateString()}
                                    </div>
                                    <DropdownMenu>
                                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                            <Button variant="ghost" size="icon" className="h-8 w-8">
                                                <MoreHorizontal className="h-4 w-4" />
                                            </Button>
                                        </DropdownMenuTrigger>
                                        <DropdownMenuContent align="end">
                                            <DropdownMenuItem onClick={() => window.open(item.sourceUrl, "_blank")}>
                                                <ExternalLink className="h-4 w-4 mr-2" />
                                                Open Source
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/content/${item.id}/rewrite`}>
                                                    <PenTool className="h-4 w-4 mr-2" />
                                                    Rewrite
                                                </Link>
                                            </DropdownMenuItem>
                                            <DropdownMenuItem asChild>
                                                <Link href={`/content/${item.id}/publish`}>
                                                    <Send className="h-4 w-4 mr-2" />
                                                    Publish
                                                </Link>
                                            </DropdownMenuItem>
                                        </DropdownMenuContent>
                                    </DropdownMenu>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
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
