"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { formatNumber, formatDate } from "@/lib/formatters"
import {
    ExternalLink,
    PenTool,
    Send,
    Heart,
    Eye,
    MessageCircle,
    Trash2,
} from "lucide-react"

// ==================== Types ====================

export interface ContentItem {
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
        directUrl?: string
        thumbnailUrl?: string
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
    rawJson?: any
    approvedRewriteVersionId?: string
}

interface ContentCardProps {
    item: ContentItem
    isSelected: boolean
    onSelect: (itemId: string, e: React.MouseEvent) => void
    onDelete: (itemId: string, e: React.MouseEvent) => void
    onItemClick: (item: ContentItem) => void
    isDeleting: boolean
}

// ==================== Content Card Component ====================

export function ContentCard({
    item,
    isSelected,
    onSelect,
    onDelete,
    onItemClick,
    isDeleting,
}: ContentCardProps) {
    const router = useRouter()

    // Extract data from rawJson
    const rawJson = item.rawJson || {}

    /* eslint-disable @typescript-eslint/no-explicit-any */
    const graphqlLegacy = (rawJson as any)?.data?.tweetResult?.result?.legacy ||
        (rawJson as any)?.data?.tweetResult?.result?.tweet?.legacy || {}
    const graphqlResult = (rawJson as any)?.data?.tweetResult?.result ||
        (rawJson as any)?.data?.tweetResult?.result?.tweet || {}
    const ytdlp = rawJson as any

    const likeCount = graphqlLegacy.favorite_count ?? ytdlp.like_count ?? ytdlp.favorite_count ?? 0
    const replyCount = graphqlLegacy.reply_count ?? ytdlp.reply_count ?? 0
    const viewCount = graphqlResult.views?.count ?? ytdlp.view_count ?? 0

    const graphqlUser = (rawJson as any)?.data?.tweetResult?.result?.core?.user_results?.result?.legacy ||
        (rawJson as any)?.data?.tweetResult?.result?.tweet?.core?.user_results?.result?.legacy || {}
    /* eslint-enable @typescript-eslint/no-explicit-any */

    const authorAvatar = item.authorAvatar || graphqlUser.profile_image_url_https || ytdlp.uploader_url
    const authorName = item.authorName || graphqlUser.name || ytdlp.uploader || item.authorHandle
    const createdTime = graphqlLegacy.created_at || ytdlp.timestamp || item.createdAt

    // Extract media
    let mediaItems: Array<{ type: string; url: string; thumbnailUrl?: string }> = []

    if (item.media && Array.isArray(item.media) && item.media.length > 0) {
        mediaItems = item.media.map((m) => {
            const imageUrl = m.directUrl || m.thumbnailUrl || m.sourceUrl || ''
            return {
                type: m.type || 'image',
                url: imageUrl,
                thumbnailUrl: m.thumbnailUrl || m.directUrl || m.sourceUrl
            }
        }).filter(m => m.url)
    }

    if (mediaItems.length === 0 && item.rawJson) {
        const extMedia = item.rawJson.extended_entities?.media || item.rawJson.entities?.media || []
        if (Array.isArray(extMedia)) {
            mediaItems = extMedia.map((m: { type?: string; media_url_https?: string }) => ({
                type: m.type === 'video' || m.type === 'animated_gif' ? 'video' : 'image',
                url: m.media_url_https || '',
                thumbnailUrl: m.media_url_https
            })).filter((m: { url: string }) => m.url)
        }
    }

    return (
        <div
            className="break-inside-avoid bg-card border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 group cursor-pointer flex flex-col"
            onClick={() => onItemClick(item)}
        >
            {/* Author & Header */}
            <div className="p-4 pb-2 flex justify-between items-start gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <div className="w-9 h-9 rounded-full bg-accent/50 overflow-hidden flex-shrink-0 border">
                        {authorAvatar ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
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
                        <span className="text-sm font-semibold truncate">{authorName}</span>
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
            {mediaItems.length > 0 && (
                <div className={cn(
                    "mt-2 grid gap-0.5 overflow-hidden",
                    mediaItems.length === 1 ? "grid-cols-1" :
                        mediaItems.length === 2 ? "grid-cols-2" : "grid-cols-2"
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
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
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
                                /* eslint-disable-next-line @next/next/no-img-element */
                                <img
                                    src={m.url}
                                    alt=""
                                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
                                    loading="lazy"
                                    referrerPolicy="no-referrer"
                                    onError={(e) => {
                                        e.currentTarget.style.display = 'none'
                                        e.currentTarget.parentElement?.classList.add('hidden')
                                    }}
                                />
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* Footer */}
            <div className="p-4 pt-3 flex flex-col gap-2">
                <div className="text-[11px] text-muted-foreground/70 font-medium">
                    {formatDate(createdTime)}
                    {item.sourceUrl.includes("x.com") || item.sourceUrl.includes("twitter.com") ? " · X" : ""}
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-border/40">
                    <div className="flex items-center gap-3">
                        <div onClick={(e) => onSelect(item.id, e)}>
                            <Checkbox checked={isSelected} className="h-4 w-4" />
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
                            onClick={(e) => onDelete(item.id, e)}
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
}

// ==================== Content Grid Component ====================

interface ContentGridProps {
    items: ContentItem[]
    selectedItems: Set<string>
    onSelect: (itemId: string, e: React.MouseEvent) => void
    onDelete: (itemId: string, e: React.MouseEvent) => void
    onItemClick: (item: ContentItem) => void
    isDeleting: boolean
}

export function ContentGrid({
    items,
    selectedItems,
    onSelect,
    onDelete,
    onItemClick,
    isDeleting,
}: ContentGridProps) {
    return (
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {items.map((item) => (
                <ContentCard
                    key={item.id}
                    item={item}
                    isSelected={selectedItems.has(item.id)}
                    onSelect={onSelect}
                    onDelete={onDelete}
                    onItemClick={onItemClick}
                    isDeleting={isDeleting}
                />
            ))}
        </div>
    )
}

// ==================== Bulk Action Bar Component ====================

interface BulkActionBarProps {
    selectedCount: number
    onMove: () => void
    onRewrite: () => void
    onPublish: () => void
    onDelete: () => void
    onClear: () => void
    isLoading: boolean
}

export function BulkActionBar({
    selectedCount,
    onMove,
    onRewrite,
    onPublish,
    onDelete,
    onClear,
    isLoading,
}: BulkActionBarProps) {
    if (selectedCount === 0) return null

    return (
        <div className="mb-4 p-3 bg-accent/50 rounded-lg border flex items-center justify-between">
            <div className="text-sm font-medium">
                已选中 {selectedCount} 项
            </div>
            <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={onMove} disabled={isLoading}>
                    移动至...
                </Button>
                <Button variant="outline" size="sm" onClick={onRewrite} disabled={isLoading}>
                    批量改写
                </Button>
                <Button variant="outline" size="sm" onClick={onPublish} disabled={isLoading}>
                    批量发布
                </Button>
                <div className="w-px h-6 bg-border mx-1" />
                <Button variant="ghost" size="sm" onClick={onClear}>
                    取消
                </Button>
                <Button variant="destructive" size="sm" onClick={onDelete} disabled={isLoading}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
