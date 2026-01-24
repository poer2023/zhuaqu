"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { Heart, MessageCircle, Repeat2, Share, BarChart2, Bookmark } from "lucide-react"

interface TweetPreviewProps {
    content: string
    authorName?: string
    authorHandle?: string
    authorAvatar?: string
    media?: Array<{ type: string; url: string }>
    isThread?: boolean
    threadIndex?: number
    totalThreads?: number
    showEngagement?: boolean
    className?: string
}

// X/Twitter character limit
const CHAR_LIMIT = 280
// Links are counted as 23 characters regardless of length
const LINK_LENGTH = 23

/**
 * Calculate tweet length according to X's rules:
 * - Each URL counts as 23 characters
 * - Emojis count as 2 characters
 * - Regular characters count as 1
 */
function calculateTweetLength(text: string): number {
    // Match URLs (simplified pattern)
    const urlPattern = /https?:\/\/[^\s]+/g
    const urls = text.match(urlPattern) || []

    // Remove URLs from text for character counting
    let textWithoutUrls = text.replace(urlPattern, "")

    // Count remaining characters (simplified - treating emojis as 2)
    // In reality, X uses Twitter Text library for precise counting
    let charCount = 0
    for (const char of textWithoutUrls) {
        // Basic emoji detection (most emojis are outside BMP)
        if (char.codePointAt(0)! > 0xFFFF) {
            charCount += 2
        } else {
            charCount += 1
        }
    }

    // Add URL counts
    charCount += urls.length * LINK_LENGTH

    return charCount
}

/**
 * Parse and highlight mentions, hashtags, and links
 */
function parseContent(text: string): React.ReactNode[] {
    const parts: React.ReactNode[] = []
    const pattern = /(@\w+|#\w+|https?:\/\/[^\s]+)/g
    let lastIndex = 0
    let match
    let key = 0

    while ((match = pattern.exec(text)) !== null) {
        // Add text before match
        if (match.index > lastIndex) {
            parts.push(text.slice(lastIndex, match.index))
        }

        const matched = match[0]
        if (matched.startsWith("@")) {
            parts.push(
                <span key={key++} className="text-blue-500 hover:underline cursor-pointer">
                    {matched}
                </span>
            )
        } else if (matched.startsWith("#")) {
            parts.push(
                <span key={key++} className="text-blue-500 hover:underline cursor-pointer">
                    {matched}
                </span>
            )
        } else {
            // URL - show shortened version
            const displayUrl = matched.replace(/^https?:\/\//, "").slice(0, 30)
            parts.push(
                <span key={key++} className="text-blue-500 hover:underline cursor-pointer">
                    {displayUrl}{matched.length > 38 ? "..." : ""}
                </span>
            )
        }
        lastIndex = match.index + matched.length
    }

    // Add remaining text
    if (lastIndex < text.length) {
        parts.push(text.slice(lastIndex))
    }

    return parts
}

export function TweetPreview({
    content,
    authorName = "Your Name",
    authorHandle = "yourhandle",
    authorAvatar,
    isThread = false,
    threadIndex,
    totalThreads,
    showEngagement = true,
    className,
}: TweetPreviewProps) {
    const charCount = useMemo(() => calculateTweetLength(content), [content])
    const isOverLimit = charCount > CHAR_LIMIT
    const isNearLimit = charCount > CHAR_LIMIT - 20 && !isOverLimit
    const remainingChars = CHAR_LIMIT - charCount

    const parsedContent = useMemo(() => parseContent(content), [content])

    return (
        <div className={cn("bg-background border rounded-xl p-4", className)}>
            {/* Thread indicator */}
            {isThread && threadIndex !== undefined && (
                <div className="flex items-center gap-2 mb-2 text-xs text-muted-foreground">
                    <div className="w-0.5 h-4 bg-muted-foreground/30 rounded-full" />
                    <span>Tweet {threadIndex + 1}{totalThreads ? ` of ${totalThreads}` : ""}</span>
                </div>
            )}

            {/* Author info */}
            <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="shrink-0">
                    {authorAvatar ? (
                        <img
                            src={authorAvatar}
                            alt={authorName}
                            className="w-10 h-10 rounded-full object-cover"
                        />
                    ) : (
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white font-bold text-sm">
                            {authorName.charAt(0).toUpperCase()}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    {/* Name and handle */}
                    <div className="flex items-center gap-1 flex-wrap">
                        <span className="font-bold text-sm truncate">{authorName}</span>
                        <span className="text-muted-foreground text-sm">@{authorHandle}</span>
                        <span className="text-muted-foreground text-sm">·</span>
                        <span className="text-muted-foreground text-sm">now</span>
                    </div>

                    {/* Tweet content */}
                    <div className="mt-1 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                        {content ? parsedContent : (
                            <span className="text-muted-foreground/50 italic">
                                Start typing to see preview...
                            </span>
                        )}
                    </div>

                    {/* Thread connector */}
                    {isThread && threadIndex !== undefined && threadIndex < (totalThreads || 1) - 1 && (
                        <div className="flex justify-center mt-3">
                            <div className="w-0.5 h-6 bg-muted-foreground/20 rounded-full" />
                        </div>
                    )}

                    {/* Engagement buttons */}
                    {showEngagement && (
                        <div className="flex items-center justify-between mt-3 max-w-[425px]">
                            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-500 transition-colors group">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                    <MessageCircle className="h-4 w-4" />
                                </div>
                            </button>
                            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-green-500 transition-colors group">
                                <div className="p-1.5 rounded-full group-hover:bg-green-500/10 transition-colors">
                                    <Repeat2 className="h-4 w-4" />
                                </div>
                            </button>
                            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-pink-500 transition-colors group">
                                <div className="p-1.5 rounded-full group-hover:bg-pink-500/10 transition-colors">
                                    <Heart className="h-4 w-4" />
                                </div>
                            </button>
                            <button className="flex items-center gap-1.5 text-muted-foreground hover:text-blue-500 transition-colors group">
                                <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                    <BarChart2 className="h-4 w-4" />
                                </div>
                            </button>
                            <div className="flex items-center gap-1">
                                <button className="flex items-center text-muted-foreground hover:text-blue-500 transition-colors group">
                                    <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                        <Bookmark className="h-4 w-4" />
                                    </div>
                                </button>
                                <button className="flex items-center text-muted-foreground hover:text-blue-500 transition-colors group">
                                    <div className="p-1.5 rounded-full group-hover:bg-blue-500/10 transition-colors">
                                        <Share className="h-4 w-4" />
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Character counter */}
            <div className="flex items-center justify-end mt-3 pt-3 border-t">
                <div className="flex items-center gap-2">
                    {/* Circular progress indicator */}
                    <div className="relative w-5 h-5">
                        <svg className="w-5 h-5 -rotate-90" viewBox="0 0 20 20">
                            <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="text-muted/30"
                            />
                            <circle
                                cx="10"
                                cy="10"
                                r="8"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeDasharray={`${Math.min(charCount / CHAR_LIMIT, 1) * 50.27} 50.27`}
                                className={cn(
                                    "transition-all",
                                    isOverLimit && "text-red-500",
                                    isNearLimit && "text-amber-500",
                                    !isOverLimit && !isNearLimit && "text-blue-500"
                                )}
                            />
                        </svg>
                    </div>

                    {/* Character count text */}
                    <span
                        className={cn(
                            "text-xs font-mono tabular-nums",
                            isOverLimit && "text-red-500 font-medium",
                            isNearLimit && "text-amber-500",
                            !isOverLimit && !isNearLimit && "text-muted-foreground"
                        )}
                    >
                        {isOverLimit ? remainingChars : `${charCount}/${CHAR_LIMIT}`}
                    </span>
                </div>
            </div>

            {/* Warning messages */}
            {isOverLimit && (
                <div className="mt-2 px-3 py-2 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-lg">
                    <p className="text-xs text-red-600 dark:text-red-400">
                        Tweet exceeds character limit by {Math.abs(remainingChars)} characters.
                        Consider splitting into a thread.
                    </p>
                </div>
            )}
        </div>
    )
}

// Export utility function for use elsewhere
export { calculateTweetLength, CHAR_LIMIT }
