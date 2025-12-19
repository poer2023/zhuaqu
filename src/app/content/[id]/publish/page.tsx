"use client"

import { useEffect, useState, useCallback, use } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import {
    ArrowLeft,
    Send,
    Clock,
    CalendarIcon,
    History,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Twitter,
    ShieldCheck,
} from "lucide-react"
import { format } from "date-fns"

interface ContentItem {
    workspaceId: string
    id: string
    sourceUrl: string
    authorHandle: string
    textOriginal: string
    rewriteStatus: string
    publishStatus: string
    publishResults?: Array<{
        id: string
        tweetId: string
        tweetUrl: string
        position: number
        publishedAt: string
    }>
    rewriteVersions?: Array<{
        id: string
        version: number
        status: string
        output: unknown
        outputFormat?: string
    }>
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

export default function PublishPage({
    params
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = use(params)
    const searchParams = useSearchParams()

    const [item, setItem] = useState<ContentItem | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isPublishing, setIsPublishing] = useState(false)
    const [scheduleDate, setScheduleDate] = useState<Date | undefined>(undefined)
    const [scheduleTime, setScheduleTime] = useState<string>("12:00")

    // 合规确认
    const [complianceConfirmed, setComplianceConfirmed] = useState(false)

    const returnUrl = searchParams.get("from") || `/content/${id}`

    const fetchItem = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await fetch(`/api/content-items/${id}`)
            if (res.ok) {
                const data = await res.json()
                setItem(data.item)
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

    const handlePublishNow = async () => {
        setIsPublishing(true)
        try {
            if (!item) return
            const approved = item.rewriteVersions?.find(v => v.status === "APPROVED")
            if (!approved) return

            const mode = Array.isArray(approved.output) || approved.outputFormat === "thread" ? "thread" : "single"
            await fetch(`/api/publish/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: item.workspaceId,
                    rewriteVersionIds: [approved.id],
                    mode,
                    complianceConfirmed: true,
                }),
            })
            await fetchItem()
        } finally {
            setIsPublishing(false)
        }
    }

    const handleSchedule = async () => {
        if (!scheduleDate) return
        setIsPublishing(true)
        try {
            const [hours, minutes] = scheduleTime.split(":")
            const publishAt = new Date(scheduleDate)
            publishAt.setHours(parseInt(hours), parseInt(minutes))

            if (!item) return
            const approved = item.rewriteVersions?.find(v => v.status === "APPROVED")
            if (!approved) return
            const mode = Array.isArray(approved.output) || approved.outputFormat === "thread" ? "thread" : "single"

            await fetch(`/api/publish/jobs`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: item.workspaceId,
                    rewriteVersionIds: [approved.id],
                    mode,
                    scheduledAt: publishAt.toISOString(),
                    complianceConfirmed: true,
                }),
            })
            await fetchItem()
        } finally {
            setIsPublishing(false)
        }
    }

    // Get approved rewrite text
    const approvedVersion = item?.rewriteVersions?.find(v => v.status === "APPROVED")
    const publishText = (() => {
        const output = approvedVersion?.output
        if (Array.isArray(output)) {
            return output
                .map((o) => (isRecord(o) && typeof o.text === "string" ? o.text : ""))
                .filter(Boolean)
                .join("\n\n")
        }
        if (isRecord(output) && typeof output.text === "string") return output.text
        return item?.textOriginal || ""
    })()

    const isApproved = item?.rewriteStatus?.toUpperCase() === "APPROVED"

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
                                <Send className="h-4 w-4 text-muted-foreground" />
                                <span className="font-medium">发布</span>
                                <Badge variant="outline" className="text-xs">
                                    @{item.authorHandle}
                                </Badge>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Button
                                onClick={handlePublishNow}
                                disabled={isPublishing || !isApproved || !complianceConfirmed}
                            >
                                {isPublishing ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <Send className="h-4 w-4 mr-2" />
                                        立即发布
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-6xl mx-auto px-6 py-6">
                {/* Not approved warning */}
                {!isApproved && (
                    <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-900/10 flex items-start gap-3">
                        <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                        <div>
                            <div className="font-medium text-amber-800 dark:text-amber-200">改写尚未通过</div>
                            <div className="text-sm text-amber-700 dark:text-amber-300">
                                请先在改写页面审核并通过内容，然后再发布。
                            </div>
                            <Button variant="outline" size="sm" className="mt-2" asChild>
                                <Link href={`/content/${id}/rewrite`}>
                                    前往改写
                                </Link>
                            </Button>
                        </div>
                    </div>
                )}

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Left: Preview */}
                    <div className="space-y-4">
                        <div className="rounded-lg border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/30">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                    发布预览
                                </Label>
                            </div>
                            <div className="p-4">
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                                    {publishText}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right: Settings & History */}
                    <div className="space-y-4">
                        {/* Compliance Confirmation */}
                        <div className={`rounded-lg border p-4 space-y-3 transition-colors ${complianceConfirmed
                                ? "bg-green-50/50 border-green-200 dark:bg-green-900/10 dark:border-green-900/30"
                                : "bg-card"
                            }`}>
                            <div className="flex items-start gap-3">
                                <ShieldCheck className={`h-5 w-5 shrink-0 mt-0.5 ${complianceConfirmed ? "text-green-600" : "text-muted-foreground"
                                    }`} />
                                <div className="flex-1 space-y-2">
                                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                        发布前确认
                                    </Label>
                                    <div className="flex items-start gap-2">
                                        <Checkbox
                                            id="compliance"
                                            checked={complianceConfirmed}
                                            onCheckedChange={(checked) => setComplianceConfirmed(checked === true)}
                                            className="mt-0.5"
                                        />
                                        <label
                                            htmlFor="compliance"
                                            className="text-sm text-muted-foreground leading-relaxed cursor-pointer"
                                        >
                                            我已确认此内容符合平台规范，不含敏感信息、侵权内容或违规言论，且已获得必要授权进行发布。
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Schedule */}
                        <div className="rounded-lg border bg-card p-4 space-y-4">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                定时发布
                            </Label>
                            <div className="flex gap-2">
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="flex-1 justify-start">
                                            <CalendarIcon className="h-4 w-4 mr-2" />
                                            {scheduleDate ? format(scheduleDate, "yyyy-MM-dd") : "选择日期"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar
                                            mode="single"
                                            selected={scheduleDate}
                                            onSelect={setScheduleDate}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <Input
                                    type="time"
                                    value={scheduleTime}
                                    onChange={(e) => setScheduleTime(e.target.value)}
                                    className="w-[120px]"
                                />
                            </div>
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={handleSchedule}
                                disabled={!scheduleDate || isPublishing || !isApproved || !complianceConfirmed}
                            >
                                <Clock className="h-4 w-4 mr-2" />
                                设置定时发布
                            </Button>
                        </div>

                        {/* Publish History */}
                        <div className="rounded-lg border bg-card">
                            <div className="px-4 py-2 border-b bg-muted/30">
                                <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                    <History className="h-3 w-3" />
                                    发布历史
                                </Label>
                            </div>
                            <div className="divide-y max-h-[200px] overflow-y-auto">
                                {item.publishResults?.length ? (
                                    item.publishResults.map((r) => (
                                        <div key={r.id} className="px-4 py-3">
                                            <div className="flex items-center justify-between mb-1">
                                                <div className="flex items-center gap-2">
                                                    <Twitter className="h-3.5 w-3.5" />
                                                    <a
                                                        href={r.tweetUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="text-xs font-medium hover:underline"
                                                    >
                                                        View tweet #{r.position + 1}
                                                    </a>
                                                </div>
                                                <Badge variant="outline" className="text-[9px] bg-green-50 text-green-600 border-green-200">
                                                    <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
                                                    PUBLISHED
                                                </Badge>
                                            </div>
                                            <div className="text-[10px] text-muted-foreground">
                                                {format(new Date(r.publishedAt), "yyyy-MM-dd HH:mm")}
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="p-8 text-center text-muted-foreground">
                                        <History className="h-8 w-8 mx-auto mb-2 opacity-40" />
                                        <p className="text-sm">暂无发布记录</p>
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
