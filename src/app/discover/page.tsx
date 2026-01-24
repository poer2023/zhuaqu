"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
    Search,
    TrendingUp,
    Flame,
    Clock,
    Heart,
    Bookmark,
    BookmarkCheck,
    Import,
    Filter,
    Loader2,
    ExternalLink,
    MessageCircle,
    Repeat2,
    Eye,
    Settings,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { formatNumber } from "@/lib/formatters"
import Link from "next/link"

interface DiscoveredItem {
    id: string
    sourceId: string
    sourceUrl: string
    authorHandle: string
    authorName?: string
    authorAvatar?: string
    textContent: string
    media: Array<{ type: string; url: string }>
    likeCount: number
    retweetCount: number
    replyCount: number
    viewCount: number
    viralScore: number
    isImported: boolean
    isBookmarked: boolean
    discoveredAt: string
    topic: {
        id: string
        name: string
    }
}

interface Topic {
    id: string
    name: string
    _count: { discoveries: number }
}

type SortBy = "viral" | "recent" | "likes"
type FilterType = "all" | "bookmarked" | "not_imported"

export default function DiscoverPage() {
    const { currentWorkspaceId, currentWorkspace, fetchWorkspaces } = useWorkspaceStore()

    const [discoveries, setDiscoveries] = useState<DiscoveredItem[]>([])
    const [topics, setTopics] = useState<Topic[]>([])
    const [selectedTopicId, setSelectedTopicId] = useState<string>("all")
    const [sortBy, setSortBy] = useState<SortBy>("viral")
    const [filter, setFilter] = useState<FilterType>("all")
    const [searchQuery, setSearchQuery] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

    // Pagination
    const [hasMore, setHasMore] = useState(true)
    const [offset, setOffset] = useState(0)
    const limit = 30

    // Load workspaces
    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    // Load topics
    useEffect(() => {
        if (!currentWorkspaceId) return

        fetch(`/api/topics?workspaceId=${currentWorkspaceId}`)
            .then((res) => res.json())
            .then((data) => setTopics(data.topics || []))
            .catch(console.error)
    }, [currentWorkspaceId])

    // Load discoveries
    const loadDiscoveries = useCallback(async (reset = false) => {
        if (!currentWorkspaceId) return

        setIsLoading(true)
        try {
            const params = new URLSearchParams({
                workspaceId: currentWorkspaceId,
                sortBy,
                filter,
                limit: limit.toString(),
                offset: reset ? "0" : offset.toString(),
            })

            if (selectedTopicId !== "all") {
                params.set("topicId", selectedTopicId)
            }

            const res = await fetch(`/api/discover?${params}`)
            const data = await res.json()

            if (reset) {
                setDiscoveries(data.discoveries || [])
                setOffset(limit)
            } else {
                setDiscoveries((prev) => [...prev, ...(data.discoveries || [])])
                setOffset((prev) => prev + limit)
            }

            setHasMore(data.pagination?.hasMore ?? false)
        } catch (error) {
            console.error("Failed to load discoveries:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspaceId, selectedTopicId, sortBy, filter, offset])

    // Initial load and filter changes
    useEffect(() => {
        if (currentWorkspaceId) {
            setOffset(0)
            loadDiscoveries(true)
        }
    }, [currentWorkspaceId, selectedTopicId, sortBy, filter])

    // Toggle selection
    const toggleSelect = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

    // Toggle bookmark
    const toggleBookmark = async (id: string, currentState: boolean) => {
        const newState = !currentState

        // Optimistic update
        setDiscoveries((prev) =>
            prev.map((d) => (d.id === id ? { ...d, isBookmarked: newState } : d))
        )

        try {
            const res = await fetch("/api/discover", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "bookmark",
                    discoveryId: id,
                    isBookmarked: newState,
                    workspaceId: currentWorkspaceId,
                }),
            })

            if (!res.ok) {
                throw new Error("Failed to update bookmark")
            }
        } catch (error) {
            // Rollback on failure
            setDiscoveries((prev) =>
                prev.map((d) => (d.id === id ? { ...d, isBookmarked: currentState } : d))
            )
            console.error("Failed to toggle bookmark:", error)
        }
    }

    // Import selected
    const handleImport = async () => {
        if (selectedIds.size === 0 || !currentWorkspaceId) return

        const defaultPoolId = currentWorkspace?.pools?.[0]?.id
        if (!defaultPoolId) {
            alert("请先创建素材池")
            return
        }

        setIsLoading(true)
        try {
            const res = await fetch("/api/discover", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    discoveryIds: Array.from(selectedIds),
                    poolId: defaultPoolId,
                    workspaceId: currentWorkspaceId,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                // Update local state
                setDiscoveries((prev) =>
                    prev.map((d) =>
                        selectedIds.has(d.id) ? { ...d, isImported: true } : d
                    )
                )
                setSelectedIds(new Set())
                alert(`成功导入 ${data.summary.imported} 条，重复 ${data.summary.duplicates} 条`)
            }
        } catch (error) {
            console.error("Failed to import:", error)
        } finally {
            setIsLoading(false)
        }
    }

    // Filter by search
    const filteredDiscoveries = discoveries.filter((d) => {
        if (!searchQuery) return true
        const q = searchQuery.toLowerCase()
        return (
            d.textContent.toLowerCase().includes(q) ||
            d.authorHandle.toLowerCase().includes(q) ||
            d.authorName?.toLowerCase().includes(q)
        )
    })

    return (
        <PageShell
            title="Discover"
            description="发现热门内容，一键导入素材池"
            headerAction={
                <Link href="/settings/topics">
                    <Button variant="outline" size="sm" className="h-8 text-xs">
                        <Settings className="h-3.5 w-3.5 mr-1.5" />
                        管理话题
                    </Button>
                </Link>
            }
        >
            <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3 flex-wrap">
                    {/* Topic filter */}
                    <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                        <SelectTrigger className="w-[160px] h-8 text-xs">
                            <SelectValue placeholder="全部话题" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部话题</SelectItem>
                            {topics.map((topic) => (
                                <SelectItem key={topic.id} value={topic.id}>
                                    {topic.name} ({topic._count.discoveries})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {/* Sort */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5">
                        <Button
                            variant={sortBy === "viral" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setSortBy("viral")}
                        >
                            <Flame className="h-3 w-3 mr-1" />
                            热度
                        </Button>
                        <Button
                            variant={sortBy === "recent" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setSortBy("recent")}
                        >
                            <Clock className="h-3 w-3 mr-1" />
                            最新
                        </Button>
                        <Button
                            variant={sortBy === "likes" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs px-2"
                            onClick={() => setSortBy("likes")}
                        >
                            <Heart className="h-3 w-3 mr-1" />
                            点赞
                        </Button>
                    </div>

                    {/* Filter */}
                    <Select value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
                        <SelectTrigger className="w-[120px] h-8 text-xs">
                            <Filter className="h-3 w-3 mr-1" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">全部</SelectItem>
                            <SelectItem value="not_imported">未导入</SelectItem>
                            <SelectItem value="bookmarked">已收藏</SelectItem>
                        </SelectContent>
                    </Select>

                    {/* Search */}
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="搜索内容..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 pl-8 text-xs"
                        />
                    </div>
                </div>

                {/* Content Grid */}
                {isLoading && discoveries.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : filteredDiscoveries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm">暂无发现内容</p>
                        <p className="text-xs mt-1">请先添加话题订阅</p>
                        <Link href="/settings/topics" className="mt-4">
                            <Button size="sm" variant="outline">
                                添加话题
                            </Button>
                        </Link>
                    </div>
                ) : (
                    <div className="columns-1 md:columns-2 lg:columns-3 gap-4 space-y-4">
                        {filteredDiscoveries.map((item) => (
                            <div
                                key={item.id}
                                className={cn(
                                    "break-inside-avoid bg-card border rounded-xl overflow-hidden transition-all",
                                    selectedIds.has(item.id) && "ring-2 ring-primary",
                                    item.isImported && "opacity-60"
                                )}
                            >
                                {/* Header */}
                                <div className="p-3 flex items-start justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                        <Checkbox
                                            checked={selectedIds.has(item.id)}
                                            onCheckedChange={() => toggleSelect(item.id)}
                                            disabled={item.isImported}
                                        />
                                        <div className="w-8 h-8 rounded-full bg-muted overflow-hidden flex-shrink-0">
                                            {item.authorAvatar ? (
                                                /* eslint-disable-next-line @next/next/no-img-element */
                                                <img
                                                    src={item.authorAvatar}
                                                    alt=""
                                                    className="w-full h-full object-cover"
                                                    referrerPolicy="no-referrer"
                                                />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-xs font-bold">
                                                    {item.authorHandle[0]?.toUpperCase()}
                                                </div>
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {item.authorName || item.authorHandle}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                @{item.authorHandle}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Badge variant="secondary" className="text-[9px] h-5">
                                            {item.topic.name}
                                        </Badge>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => toggleBookmark(item.id, item.isBookmarked)}
                                        >
                                            {item.isBookmarked ? (
                                                <BookmarkCheck className="h-3.5 w-3.5 text-primary" />
                                            ) : (
                                                <Bookmark className="h-3.5 w-3.5" />
                                            )}
                                        </Button>
                                    </div>
                                </div>

                                {/* Content */}
                                <div className="px-3 pb-2">
                                    <p className="text-sm whitespace-pre-wrap line-clamp-6">
                                        {item.textContent}
                                    </p>
                                </div>

                                {/* Media */}
                                {item.media && item.media.length > 0 && (
                                    <div className="px-3 pb-2">
                                        <div className="rounded-lg overflow-hidden bg-muted aspect-video">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img
                                                src={item.media[0].url}
                                                alt=""
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                referrerPolicy="no-referrer"
                                            />
                                        </div>
                                    </div>
                                )}

                                {/* Stats */}
                                <div className="px-3 py-2 border-t flex items-center justify-between text-xs text-muted-foreground">
                                    <div className="flex items-center gap-3">
                                        <span className="flex items-center gap-1">
                                            <Heart className="h-3 w-3" />
                                            {formatNumber(item.likeCount)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Repeat2 className="h-3 w-3" />
                                            {formatNumber(item.retweetCount)}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <MessageCircle className="h-3 w-3" />
                                            {formatNumber(item.replyCount)}
                                        </span>
                                        {item.viewCount > 0 && (
                                            <span className="flex items-center gap-1">
                                                <Eye className="h-3 w-3" />
                                                {formatNumber(item.viewCount)}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {item.isImported && (
                                            <Badge variant="outline" className="text-[9px] h-4 text-green-600">
                                                已导入
                                            </Badge>
                                        )}
                                        <a
                                            href={item.sourceUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="hover:text-foreground"
                                        >
                                            <ExternalLink className="h-3 w-3" />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Load more */}
                {hasMore && !isLoading && (
                    <div className="flex justify-center pt-4">
                        <Button
                            variant="outline"
                            onClick={() => loadDiscoveries(false)}
                            disabled={isLoading}
                        >
                            加载更多
                        </Button>
                    </div>
                )}

                {isLoading && discoveries.length > 0 && (
                    <div className="flex justify-center pt-4">
                        <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                )}
            </div>

            {/* Floating action bar */}
            {selectedIds.size > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4">
                    <div className="glass px-4 py-2 rounded-full shadow-2xl flex items-center gap-3 border">
                        <span className="text-xs font-medium">
                            已选 {selectedIds.size} 条
                        </span>
                        <div className="h-4 w-px bg-border" />
                        <Button
                            size="sm"
                            className="h-7 text-xs"
                            onClick={handleImport}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                                <Import className="h-3 w-3 mr-1" />
                            )}
                            导入素材池
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => setSelectedIds(new Set())}
                        >
                            取消
                        </Button>
                    </div>
                </div>
            )}
        </PageShell>
    )
}
