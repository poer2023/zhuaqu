"use client"

import { useState, useCallback } from "react"
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from "@dnd-kit/core"
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { GripVertical, Plus, Trash2, Scissors } from "lucide-react"
import { CharCounterCompact, CHAR_LIMIT } from "./CharCounter"

export interface ThreadTweet {
    id: string
    text: string
    position: number
}

interface ThreadEditorProps {
    tweets: ThreadTweet[]
    onChange: (tweets: ThreadTweet[]) => void
    authorName?: string
    authorHandle?: string
    className?: string
}

interface SortableTweetItemProps {
    tweet: ThreadTweet
    index: number
    total: number
    onTextChange: (id: string, text: string) => void
    onDelete: (id: string) => void
    onSplit: (id: string) => void
}

function SortableTweetItem({
    tweet,
    index,
    total,
    onTextChange,
    onDelete,
    onSplit,
}: SortableTweetItemProps) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: tweet.id })

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    }

    const charCount = tweet.text.length
    const isOverLimit = charCount > CHAR_LIMIT

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={cn(
                "relative group",
                isDragging && "z-50"
            )}
        >
            {/* Thread connector line */}
            {index < total - 1 && (
                <div className="absolute left-5 top-full w-0.5 h-4 bg-muted-foreground/20 z-0" />
            )}

            <div
                className={cn(
                    "bg-background border rounded-lg p-3 transition-all",
                    isDragging && "shadow-lg ring-2 ring-primary/20",
                    isOverLimit && "border-red-300 bg-red-50/50 dark:bg-red-950/20"
                )}
            >
                <div className="flex gap-2">
                    {/* Drag handle */}
                    <button
                        className="shrink-0 p-1 text-muted-foreground hover:text-foreground cursor-grab active:cursor-grabbing touch-none"
                        {...attributes}
                        {...listeners}
                    >
                        <GripVertical className="h-4 w-4" />
                    </button>

                    {/* Tweet number indicator */}
                    <div className="shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                        {index + 1}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                        <Textarea
                            value={tweet.text}
                            onChange={(e) => onTextChange(tweet.id, e.target.value)}
                            placeholder={index === 0 ? "Start your thread..." : "Continue your thread..."}
                            className={cn(
                                "min-h-[80px] text-sm resize-none border-0 p-0 focus-visible:ring-0 bg-transparent",
                                isOverLimit && "text-red-600"
                            )}
                        />

                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-dashed">
                            <CharCounterCompact text={tweet.text} />

                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {isOverLimit && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs px-2 text-amber-600 hover:text-amber-700 hover:bg-amber-50"
                                        onClick={() => onSplit(tweet.id)}
                                    >
                                        <Scissors className="h-3 w-3 mr-1" />
                                        Split
                                    </Button>
                                )}
                                {total > 1 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => onDelete(tweet.id)}
                                    >
                                        <Trash2 className="h-3 w-3" />
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export function ThreadEditor({
    tweets,
    onChange,
    className,
}: ThreadEditorProps) {
    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    )

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event

        if (over && active.id !== over.id) {
            const oldIndex = tweets.findIndex((t) => t.id === active.id)
            const newIndex = tweets.findIndex((t) => t.id === over.id)

            const newTweets = arrayMove(tweets, oldIndex, newIndex).map((t, i) => ({
                ...t,
                position: i,
            }))

            onChange(newTweets)
        }
    }, [tweets, onChange])

    const handleTextChange = useCallback((id: string, text: string) => {
        onChange(
            tweets.map((t) => (t.id === id ? { ...t, text } : t))
        )
    }, [tweets, onChange])

    const handleDelete = useCallback((id: string) => {
        const newTweets = tweets
            .filter((t) => t.id !== id)
            .map((t, i) => ({ ...t, position: i }))
        onChange(newTweets)
    }, [tweets, onChange])

    const handleSplit = useCallback((id: string) => {
        const index = tweets.findIndex((t) => t.id === id)
        if (index === -1) return

        const tweet = tweets[index]
        const text = tweet.text

        // Find a good split point (prefer sentence end, then space near middle)
        let splitIndex = text.length
        const midPoint = Math.floor(CHAR_LIMIT * 0.9)

        // Look for sentence endings
        const sentenceEnds = [". ", "! ", "? ", "。", "！", "？"]
        for (const end of sentenceEnds) {
            const idx = text.lastIndexOf(end, midPoint)
            if (idx > 50) {
                splitIndex = idx + end.length
                break
            }
        }

        // If no sentence end, find space near limit
        if (splitIndex === text.length) {
            const spaceIdx = text.lastIndexOf(" ", CHAR_LIMIT)
            if (spaceIdx > 50) {
                splitIndex = spaceIdx + 1
            } else {
                splitIndex = CHAR_LIMIT
            }
        }

        const firstPart = text.slice(0, splitIndex).trim()
        const secondPart = text.slice(splitIndex).trim()

        if (!secondPart) return

        const newTweet: ThreadTweet = {
            id: `tweet-${Date.now()}`,
            text: secondPart,
            position: index + 1,
        }

        const newTweets = [
            ...tweets.slice(0, index),
            { ...tweet, text: firstPart },
            newTweet,
            ...tweets.slice(index + 1),
        ].map((t, i) => ({ ...t, position: i }))

        onChange(newTweets)
    }, [tweets, onChange])

    const handleAddTweet = useCallback(() => {
        const newTweet: ThreadTweet = {
            id: `tweet-${Date.now()}`,
            text: "",
            position: tweets.length,
        }
        onChange([...tweets, newTweet])
    }, [tweets, onChange])

    return (
        <div className={cn("space-y-4", className)}>
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Thread</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                        {tweets.length} tweet{tweets.length !== 1 ? "s" : ""}
                    </span>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={handleAddTweet}
                >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Tweet
                </Button>
            </div>

            {/* Sortable list */}
            <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
            >
                <SortableContext
                    items={tweets.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                >
                    <div className="space-y-4">
                        {tweets.map((tweet, index) => (
                            <SortableTweetItem
                                key={tweet.id}
                                tweet={tweet}
                                index={index}
                                total={tweets.length}
                                onTextChange={handleTextChange}
                                onDelete={handleDelete}
                                onSplit={handleSplit}
                            />
                        ))}
                    </div>
                </SortableContext>
            </DndContext>

            {/* Add more button at bottom */}
            {tweets.length > 0 && (
                <button
                    onClick={handleAddTweet}
                    className="w-full py-3 border-2 border-dashed rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors text-sm"
                >
                    <Plus className="h-4 w-4 inline mr-1" />
                    Add another tweet
                </button>
            )}
        </div>
    )
}

// Helper to convert single text to thread format
export function textToThread(text: string): ThreadTweet[] {
    if (!text.trim()) {
        return [{ id: "tweet-1", text: "", position: 0 }]
    }

    // If under limit, return as single tweet
    if (text.length <= CHAR_LIMIT) {
        return [{ id: "tweet-1", text, position: 0 }]
    }

    // Auto-split into thread
    const tweets: ThreadTweet[] = []
    let remaining = text
    let position = 0

    while (remaining.length > 0) {
        let splitPoint = CHAR_LIMIT

        if (remaining.length > CHAR_LIMIT) {
            // Find good split point
            const sentenceEnds = [". ", "! ", "? ", "。", "！", "？", "\n\n"]
            for (const end of sentenceEnds) {
                const idx = remaining.lastIndexOf(end, CHAR_LIMIT - 5)
                if (idx > 50) {
                    splitPoint = idx + end.length
                    break
                }
            }

            // Fallback to space
            if (splitPoint === CHAR_LIMIT) {
                const spaceIdx = remaining.lastIndexOf(" ", CHAR_LIMIT)
                if (spaceIdx > 50) {
                    splitPoint = spaceIdx + 1
                }
            }
        } else {
            splitPoint = remaining.length
        }

        tweets.push({
            id: `tweet-${position + 1}`,
            text: remaining.slice(0, splitPoint).trim(),
            position,
        })

        remaining = remaining.slice(splitPoint).trim()
        position++
    }

    return tweets
}

// Helper to convert thread back to output format
export function threadToOutput(tweets: ThreadTweet[]): { text?: string; tweets?: ThreadTweet[] } {
    if (tweets.length === 1) {
        return { text: tweets[0].text }
    }
    return { tweets: tweets.map((t, i) => ({ ...t, position: i })) }
}
