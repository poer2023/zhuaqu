"use client"

import { useRef, useMemo, useCallback, useState, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { ContentCard, ContentItem } from "./ContentCard"
import { cn } from "@/lib/utils"
import { Loader2 } from "lucide-react"

interface VirtualContentGridProps {
    items: ContentItem[]
    selectedItems: Set<string>
    onSelect: (itemId: string, e: React.MouseEvent) => void
    onDelete: (itemId: string, e: React.MouseEvent) => void
    onItemClick: (item: ContentItem) => void
    isDeleting: boolean
    columns?: number
    className?: string
    onLoadMore?: () => void
    hasMore?: boolean
    isLoadingMore?: boolean
}

// Estimate card height based on content
function estimateCardHeight(item: ContentItem): number {
    const baseHeight = 180 // Header + footer
    const textLength = item.textOriginal?.length || 0
    const textLines = Math.ceil(textLength / 50) // ~50 chars per line
    const textHeight = Math.min(textLines * 20, 120) // Max 6 lines

    const hasMedia = item.media && item.media.length > 0
    const mediaHeight = hasMedia ? 200 : 0

    return baseHeight + textHeight + mediaHeight
}

export function VirtualContentGrid({
    items,
    selectedItems,
    onSelect,
    onDelete,
    onItemClick,
    isDeleting,
    columns = 3,
    className,
    onLoadMore,
    hasMore,
    isLoadingMore,
}: VirtualContentGridProps) {
    const parentRef = useRef<HTMLDivElement>(null)
    const [containerWidth, setContainerWidth] = useState(0)

    // Responsive columns based on container width
    const responsiveColumns = useMemo(() => {
        if (containerWidth < 640) return 1
        if (containerWidth < 1024) return 2
        return columns
    }, [containerWidth, columns])

    // Observe container width
    useEffect(() => {
        if (!parentRef.current) return

        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerWidth(entry.contentRect.width)
            }
        })

        observer.observe(parentRef.current)
        return () => observer.disconnect()
    }, [])

    // Group items into rows
    const rows = useMemo(() => {
        const result: ContentItem[][] = []
        for (let i = 0; i < items.length; i += responsiveColumns) {
            result.push(items.slice(i, i + responsiveColumns))
        }
        return result
    }, [items, responsiveColumns])

    // Estimate row heights
    const getRowHeight = useCallback((index: number) => {
        const row = rows[index]
        if (!row || row.length === 0) return 300

        // Use the max height of items in the row
        const maxHeight = Math.max(...row.map(estimateCardHeight))
        return maxHeight + 24 // Add gap
    }, [rows])

    const virtualizer = useVirtualizer({
        count: rows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: getRowHeight,
        overscan: 3,
    })

    const virtualRows = virtualizer.getVirtualItems()

    // Infinite scroll - load more when near bottom
    useEffect(() => {
        if (!onLoadMore || !hasMore || isLoadingMore) return

        const lastItem = virtualRows[virtualRows.length - 1]
        if (!lastItem) return

        // If we're within 5 rows of the end, load more
        if (lastItem.index >= rows.length - 5) {
            onLoadMore()
        }
    }, [virtualRows, rows.length, onLoadMore, hasMore, isLoadingMore])

    if (items.length === 0) {
        return (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
                <p className="text-sm">No items to display</p>
            </div>
        )
    }

    return (
        <div
            ref={parentRef}
            className={cn(
                "h-[calc(100vh-200px)] overflow-auto",
                className
            )}
        >
            <div
                style={{
                    height: `${virtualizer.getTotalSize()}px`,
                    width: "100%",
                    position: "relative",
                }}
            >
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index]
                    if (!row) return null

                    return (
                        <div
                            key={virtualRow.key}
                            style={{
                                position: "absolute",
                                top: 0,
                                left: 0,
                                width: "100%",
                                height: `${virtualRow.size}px`,
                                transform: `translateY(${virtualRow.start}px)`,
                            }}
                        >
                            <div
                                className="grid gap-6"
                                style={{
                                    gridTemplateColumns: `repeat(${responsiveColumns}, minmax(0, 1fr))`,
                                }}
                            >
                                {row.map((item) => (
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
                        </div>
                    )
                })}
            </div>

            {/* Loading more indicator */}
            {isLoadingMore && (
                <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    <span className="ml-2 text-sm text-muted-foreground">Loading more...</span>
                </div>
            )}
        </div>
    )
}

// Re-export ContentGrid for backwards compatibility but with virtual support
export { ContentGrid } from "./ContentCard"
