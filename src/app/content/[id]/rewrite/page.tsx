"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    RefreshCw,
    Check,
    X,
    PenTool,
    History,
    Loader2,
    Sparkles,
    Copy,
    FileText,
} from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/stores/localeStore"

interface ContentItem {
    id: string
    sourceUrl: string
    authorHandle: string
    textOriginal: string
    rewriteStatus: string
    rewriteVersions?: Array<{
        id: string
        version: number
        status: string
        output: { text: string }
        createdAt: string
    }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

export default function RewritePage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    useTranslations() // Call hook but don't destructure unused t
    const router = useRouter()
    const searchParams = useSearchParams()

    const [item, setItem] = useState<ContentItem | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isGenerating, setIsGenerating] = useState(false)
    const [editedText, setEditedText] = useState("")
    const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
    const [tone, setTone] = useState<string>("professional")

    const returnUrl = searchParams.get("from") || `/content/${id}`

    const fetchItem = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/content-items/${id}?include=rewriteVersions`)
            if (res.ok) {
                const data = await res.json()
                setItem(data.item)
                // Set latest version as selected
                if (data.item?.rewriteVersions?.length) {
                    const latest = data.item.rewriteVersions[0]
                    setSelectedVersionId(latest.id)
                    setEditedText(latest.output?.text || "")
                }
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

    const handleGenerate = async () => {
        setIsGenerating(true)
        try {
            const toneMap: Record<string, string> = {
                professional: "专业但易懂",
                casual: "轻松口语",
                humorous: "幽默风趣",
                formal: "正式严谨",
            }

            const rewriteParams = {
                language: "zh",
                audienceTone: toneMap[tone] || toneMap.professional,
                stance: "neutral",
                outputFormat: "single",
            }

            const response = await fetch("/api/rewrite/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ contentItemId: id, params: rewriteParams, force: true }),
            })

            if (!response.ok) {
                const err = await response.json().catch(() => ({}))
                throw new Error(err.error || "Rewrite stream failed")
            }
            if (!response.body) throw new Error("No response body")

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let buffer = ""
            let fullText = ""

            setEditedText("")

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                buffer += decoder.decode(value, { stream: true })

                while (true) {
                    const idx = buffer.indexOf("\n\n")
                    if (idx === -1) break

                    const frame = buffer.slice(0, idx)
                    buffer = buffer.slice(idx + 2)

                    for (const line of frame.split("\n")) {
                        if (!line.startsWith("data: ")) continue
                        const raw = line.slice(6)
                        let data: unknown
                        try {
                            data = JSON.parse(raw)
                        } catch {
                            continue
                        }

                        if (isRecord(data) && typeof data.content === "string") {
                            fullText += data.content
                            setEditedText(fullText)
                        }

                        if (isRecord(data) && data.error) {
                            throw new Error(String((data as Record<string, unknown>).error))
                        }

                        if (isRecord(data) && data.done) {
                            buffer = ""
                            break
                        }
                    }
                }
            }

            await fetchItem()
        } finally {
            setIsGenerating(false)
        }
    }

    const handleApprove = async () => {
        try {
            if (!selectedVersionId) return

            if (editedText.trim()) {
                await fetch(`/api/rewrite/versions/${selectedVersionId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action: "edit", output: { text: editedText } }),
                })
            }

            await fetch(`/api/rewrite/versions/${selectedVersionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "approve" }),
            })
            router.push(`/content/${id}`)
        } catch (error) {
            console.error("Failed to approve:", error)
        }
    }

    const handleReject = async () => {
        try {
            if (!selectedVersionId) return
            await fetch(`/api/rewrite/versions/${selectedVersionId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject" }),
            })
            router.push(`/content/${id}`)
        } catch (error) {
            console.error("Failed to reject:", error)
        }
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
                </div>
            </PageShell>
        )
    }

    return (
        <div className="min-h-screen bg-background">
            {/* Sticky Header */}
            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b">
                <div className="max-w-6xl mx-auto px-6 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Button variant="ghost" size="sm" asChild>
                                <Link href={returnUrl}>
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    返回详情
                                </Link>
                            </Button>
                            <div className="h-4 w-px bg-border" />
                            <div className="flex items-center gap-2">
                                <PenTool className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">改写</span>
                                <Badge variant="outline" className="text-xs">
                                    @{item.authorHandle}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="sm" onClick={handleReject}>
                                <X className="h-4 w-4 mr-1" />
                                驳回
                            </Button>
                            <Button size="sm" onClick={handleApprove}>
                                <Check className="h-4 w-4 mr-1" />
                                通过
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content - 2 columns */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Original vs Rewrite */}
                    <div className="space-y-4">
                        {/* Original */}
                        <div className="rounded-lg border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/30">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    原文
                                </Label>
                            </div>
                            <div className="p-4 text-sm leading-relaxed whitespace-pre-wrap max-h-[300px] overflow-y-auto">
                                {item.textOriginal}
                            </div>
                        </div>

                        {/* Rewrite Result */}
                        <div className="rounded-lg border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/30 flex items-center justify-between">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <Sparkles className="h-3 w-3" />
                                    改写结果
                                </Label>
                                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => navigator.clipboard.writeText(editedText)}>
                                    <Copy className="h-3 w-3 mr-1" />
                                    复制
                                </Button>
                            </div>
                            <div className="p-4">
                                <Textarea
                                    value={editedText}
                                    onChange={(e) => setEditedText(e.target.value)}
                                    className="min-h-[200px] text-sm resize-none border-0 p-0 focus-visible:ring-0"
                                    placeholder="点击生成按钮创建改写版本..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right: Controls & History */}
                    <div className="space-y-4">
                        {/* Generate Controls */}
                        <div className="rounded-lg border bg-card p-4 space-y-4">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                生成参数
                            </Label>
                            <div className="space-y-3">
                                <div className="space-y-1.5">
                                    <Label className="text-xs text-muted-foreground">风格</Label>
                                    <Select value={tone} onValueChange={setTone}>
                                        <SelectTrigger className="h-9">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="professional">专业</SelectItem>
                                            <SelectItem value="casual">轻松</SelectItem>
                                            <SelectItem value="humorous">幽默</SelectItem>
                                            <SelectItem value="formal">正式</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Button
                                className="w-full"
                                onClick={handleGenerate}
                                disabled={isGenerating}
                            >
                                {isGenerating ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        生成中...
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2" />
                                        重新生成
                                    </>
                                )}
                            </Button>
                        </div>

                        {/* Version History */}
                        <div className="rounded-lg border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/30">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <History className="h-3 w-3" />
                                    版本历史
                                </Label>
                            </div>
                            <div className="divide-y max-h-[300px] overflow-y-auto">
                                {item.rewriteVersions?.length ? (
                                    item.rewriteVersions.map((version) => (
                                        <button
                                            key={version.id}
                                            onClick={() => {
                                                setSelectedVersionId(version.id)
                                                setEditedText(version.output?.text || "")
                                            }}
                                            className={cn(
                                                "w-full px-4 py-3 text-left hover:bg-muted/30 transition-colors",
                                                selectedVersionId === version.id && "bg-muted/50"
                                            )}
                                        >
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-xs font-mono text-muted-foreground">
                                                    v{version.version}
                                                </span>
                                                <Badge variant="outline" className="text-[9px]">
                                                    {version.status}
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-muted-foreground line-clamp-2">
                                                {version.output?.text}
                                            </p>
                                            <div className="text-[10px] text-muted-foreground/60 mt-1">
                                                {format(new Date(version.createdAt), "MM-dd HH:mm")}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">暂无版本</p>
                                        <p className="text-xs mt-1">点击重新生成创建第一个版本</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
