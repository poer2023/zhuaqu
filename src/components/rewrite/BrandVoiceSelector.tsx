"use client"

import { useEffect, useState, useCallback } from "react"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Sparkles, Star } from "lucide-react"
import { cn } from "@/lib/utils"

interface BrandVoice {
    id: string
    name: string
    description: string | null
    isDefault: boolean
    styleProfile: Record<string, unknown> | null
}

interface BrandVoiceSelectorProps {
    workspaceId: string | null
    value: string | null
    onChange: (value: string | null) => void
    className?: string
}

export function BrandVoiceSelector({
    workspaceId,
    value,
    onChange,
    className,
}: BrandVoiceSelectorProps) {
    const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])
    const [isLoading, setIsLoading] = useState(false)

    const fetchBrandVoices = useCallback(async () => {
        if (!workspaceId) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/brand-voice?workspaceId=${workspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setBrandVoices(data.brandVoices || [])

                // Auto-select default if no value is set
                if (!value && data.brandVoices?.length > 0) {
                    const defaultVoice = data.brandVoices.find((v: BrandVoice) => v.isDefault)
                    if (defaultVoice) {
                        onChange(defaultVoice.id)
                    }
                }
            }
        } catch (error) {
            console.error("Failed to fetch brand voices:", error)
        } finally {
            setIsLoading(false)
        }
    }, [workspaceId, value, onChange])

    useEffect(() => {
        fetchBrandVoices()
    }, [fetchBrandVoices])

    if (brandVoices.length === 0) {
        return null
    }

    return (
        <div className={cn("space-y-1.5", className)}>
            <label className="text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                品牌声音
            </label>
            <Select
                value={value || "none"}
                onValueChange={(v) => onChange(v === "none" ? null : v)}
                disabled={isLoading}
            >
                <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="选择品牌声音" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="none">
                        <span className="text-muted-foreground">不使用品牌声音</span>
                    </SelectItem>
                    {brandVoices.map((voice) => (
                        <SelectItem key={voice.id} value={voice.id}>
                            <div className="flex items-center gap-2">
                                <span>{voice.name}</span>
                                {voice.isDefault && (
                                    <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                )}
                                {!voice.styleProfile && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0">
                                        未分析
                                    </Badge>
                                )}
                            </div>
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )
}

// Hook for easy brand voice management
export function useBrandVoice(workspaceId: string | null) {
    const [selectedVoiceId, setSelectedVoiceId] = useState<string | null>(null)
    const [brandVoice, setBrandVoice] = useState<BrandVoice | null>(null)

    useEffect(() => {
        if (!selectedVoiceId) {
            setBrandVoice(null)
            return
        }

        const fetchVoice = async () => {
            try {
                const res = await fetch(`/api/brand-voice/${selectedVoiceId}`)
                if (res.ok) {
                    const data = await res.json()
                    setBrandVoice(data.brandVoice)
                }
            } catch (error) {
                console.error("Failed to fetch brand voice:", error)
            }
        }

        fetchVoice()
    }, [selectedVoiceId])

    return {
        selectedVoiceId,
        setSelectedVoiceId,
        brandVoice,
    }
}
