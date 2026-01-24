"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { AlertCircle, Scissors } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CharCounterProps {
    text: string
    limit?: number
    showSplitSuggestion?: boolean
    onSplit?: () => void
    className?: string
}

// X/Twitter character limit
const DEFAULT_LIMIT = 280
// Links are counted as 23 characters
const LINK_LENGTH = 23

/**
 * Calculate tweet length according to X's rules
 */
function calculateLength(text: string): number {
    const urlPattern = /https?:\/\/[^\s]+/g
    const urls = text.match(urlPattern) || []
    let textWithoutUrls = text.replace(urlPattern, "")

    let charCount = 0
    for (const char of textWithoutUrls) {
        if (char.codePointAt(0)! > 0xFFFF) {
            charCount += 2
        } else {
            charCount += 1
        }
    }

    charCount += urls.length * LINK_LENGTH
    return charCount
}

export function CharCounter({
    text,
    limit = DEFAULT_LIMIT,
    showSplitSuggestion = true,
    onSplit,
    className,
}: CharCounterProps) {
    const charCount = useMemo(() => calculateLength(text), [text])
    const isOverLimit = charCount > limit
    const isNearLimit = charCount > limit - 20 && !isOverLimit
    const remaining = limit - charCount
    const percentage = Math.min((charCount / limit) * 100, 100)

    return (
        <div className={cn("flex items-center gap-3", className)}>
            {/* Progress bar */}
            <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
                <div
                    className={cn(
                        "h-full transition-all duration-200",
                        isOverLimit && "bg-red-500",
                        isNearLimit && "bg-amber-500",
                        !isOverLimit && !isNearLimit && "bg-blue-500"
                    )}
                    style={{ width: `${percentage}%` }}
                />
            </div>

            {/* Counter */}
            <div className="flex items-center gap-2">
                <span
                    className={cn(
                        "text-xs font-mono tabular-nums min-w-[4rem] text-right",
                        isOverLimit && "text-red-500 font-medium",
                        isNearLimit && "text-amber-500",
                        !isOverLimit && !isNearLimit && "text-muted-foreground"
                    )}
                >
                    {charCount} / {limit}
                </span>

                {/* Over limit indicator */}
                {isOverLimit && (
                    <div className="flex items-center gap-1 text-red-500">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <span className="text-xs font-medium">{remaining}</span>
                    </div>
                )}
            </div>

            {/* Split suggestion */}
            {showSplitSuggestion && isOverLimit && onSplit && (
                <Button
                    variant="outline"
                    size="sm"
                    className="h-6 text-xs px-2 text-amber-600 border-amber-200 hover:bg-amber-50"
                    onClick={onSplit}
                >
                    <Scissors className="h-3 w-3 mr-1" />
                    Split
                </Button>
            )}
        </div>
    )
}

// Compact version for inline use
export function CharCounterCompact({
    text,
    limit = DEFAULT_LIMIT,
    className,
}: {
    text: string
    limit?: number
    className?: string
}) {
    const charCount = useMemo(() => calculateLength(text), [text])
    const isOverLimit = charCount > limit
    const isNearLimit = charCount > limit - 20 && !isOverLimit
    const remaining = limit - charCount

    return (
        <span
            className={cn(
                "text-xs font-mono tabular-nums",
                isOverLimit && "text-red-500 font-medium",
                isNearLimit && "text-amber-500",
                !isOverLimit && !isNearLimit && "text-muted-foreground",
                className
            )}
        >
            {isOverLimit ? remaining : `${charCount}/${limit}`}
        </span>
    )
}

export { calculateLength, DEFAULT_LIMIT as CHAR_LIMIT }
