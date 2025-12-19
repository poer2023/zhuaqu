"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    ArrowLeft,
    ArrowRight,
    Link2,
    Settings2,
    Loader2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ExternalLink,
} from "lucide-react"

import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useIngestStore } from "@/stores/ingestStore"
import { useTranslations } from "@/stores/localeStore"

interface ValidationResult {
    valid: string[]
    duplicate: string[]
    invalid: { url: string; reason: string }[]
}

export default function IngestPage() {
    useTranslations() // Call hook but don't destructure unused t
    const router = useRouter()

    // Input state
    const [urlInput, setUrlInput] = useState("")
    const [showOptions, setShowOptions] = useState(false)
    const [mediaMode, setMediaMode] = useState<"link" | "download">("link")

    // Validation state
    const [validation, setValidation] = useState<ValidationResult | null>(null)

    // Store state
    const { currentWorkspace, currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const { currentJob, isSubmitting, createJob, clearCurrentJob, getJob } = useIngestStore()

    const [selectedPoolIdByWorkspace, setSelectedPoolIdByWorkspace] = useState<Record<string, string>>({})

    const defaultPoolId = currentWorkspace?.pools?.length
        ? (currentWorkspace.defaultPoolId || currentWorkspace.pools[0].id)
        : ""
    const selectedPoolId = currentWorkspaceId ? (selectedPoolIdByWorkspace[currentWorkspaceId] ?? "") : ""
    const effectivePoolId = selectedPoolId || defaultPoolId

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    // Parse and validate URLs
    const validateUrls = useCallback((input: string) => {
        const lines = input.split('\n').map(l => l.trim()).filter(Boolean)
        const twitterUrlRegex = /^https?:\/\/(twitter\.com|x\.com)\/\w+\/status\/\d+/i

        const seen = new Set<string>()
        const result: ValidationResult = { valid: [], duplicate: [], invalid: [] }

        for (const line of lines) {
            if (twitterUrlRegex.test(line)) {
                // Extract canonical URL
                const match = line.match(/https?:\/\/(twitter\.com|x\.com)\/(\w+)\/status\/(\d+)/)
                if (match) {
                    const canonical = `https://x.com/${match[2]}/status/${match[3]}`
                    if (seen.has(canonical)) {
                        result.duplicate.push(line)
                    } else {
                        seen.add(canonical)
                        result.valid.push(line)
                    }
                }
            } else {
                result.invalid.push({ url: line, reason: "Invalid X/Twitter URL format" })
            }
        }

        return result
    }, [])

    const handleUrlInputChange = (next: string) => {
        setUrlInput(next)
        if (next.trim()) {
            setValidation(validateUrls(next))
        } else {
            setValidation(null)
        }
    }

    // Poll job status
    const currentJobId = currentJob?.id
    const currentJobStatus = currentJob?.status
    useEffect(() => {
        if (!currentJobId) return
        if (currentJobStatus === "DONE" || currentJobStatus === "PARTIAL_FAILED") return

        void getJob(currentJobId)
        const interval = setInterval(() => {
            void getJob(currentJobId)
        }, 1500)

        return () => clearInterval(interval)
    }, [currentJobId, currentJobStatus, getJob])

    const handleIngest = async () => {
        if (!currentWorkspaceId || !effectivePoolId || !validation?.valid.length) return

        await createJob({
            workspaceId: currentWorkspaceId,
            poolId: effectivePoolId,
            urls: validation.valid,
            tags: [],
            options: { mediaMode },
        })
    }

    const handleClear = () => {
        setUrlInput("")
        setValidation(null)
        clearCurrentJob()
    }

    const totalLines = urlInput.split('\n').filter(l => l.trim()).length

    return (
        <PageShell
            title="采集/入库"
            description="批量导入内容 URL 到知识库"
            headerAction={
                <Button variant="ghost" size="sm" onClick={() => router.push('/content')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    返回列表
                </Button>
            }
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* 区域1：输入 */}
                <div className="grid lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-3">
                        <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            URLs (每行一个)
                        </Label>
                        <div className="relative">
                            <Link2 className="absolute top-3 left-3 h-4 w-4 text-muted-foreground/40" />
                            <Textarea
                                className="min-h-[200px] pl-10 pt-3 text-sm font-mono bg-background/50 resize-none"
                                placeholder="https://x.com/user/status/123...&#10;https://twitter.com/user/status/456..."
                                value={urlInput}
                                onChange={(e) => handleUrlInputChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="space-y-3">
                            <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                                目标
                            </Label>
                            <Select
                                value={effectivePoolId}
                                onValueChange={(poolId) => {
                                    if (!currentWorkspaceId) return
                                    setSelectedPoolIdByWorkspace((prev) => ({ ...prev, [currentWorkspaceId]: poolId }))
                                }}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue placeholder="Select pool..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {currentWorkspace?.pools?.map(p => (
                                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <Button
                            variant="ghost"
                            size="sm"
                            className="w-full justify-start text-muted-foreground"
                            onClick={() => setShowOptions(!showOptions)}
                        >
                            <Settings2 className="h-3.5 w-3.5 mr-2" />
                            {showOptions ? "收起选项" : "展开选项"}
                        </Button>

                        {showOptions && (
                            <div className="p-3 rounded-lg border bg-muted/30 space-y-3 animate-in slide-in-from-top-2">
                                <div className="flex items-center gap-2">
                                    <Checkbox
                                        id="download_media"
                                        checked={mediaMode === "download"}
                                        onCheckedChange={(c) => setMediaMode(c ? "download" : "link")}
                                    />
                                    <label htmlFor="download_media" className="text-sm cursor-pointer">
                                        下载视频到本地
                                    </label>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* 区域2：校验结果 */}
                {validation && totalLines > 0 && (
                    <div className="p-4 rounded-lg border bg-muted/20 animate-in slide-in-from-top-2">
                        <div className="flex items-center gap-6 text-sm">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span>有效 <strong className="text-green-600">{validation.valid.length}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <AlertCircle className="h-4 w-4 text-amber-500" />
                                <span>重复 <strong className="text-amber-600">{validation.duplicate.length}</strong></span>
                            </div>
                            <div className="flex items-center gap-2">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span>无效 <strong className="text-red-600">{validation.invalid.length}</strong></span>
                            </div>
                        </div>

                        {validation.invalid.length > 0 && (
                            <div className="mt-3 space-y-1">
                                {validation.invalid.slice(0, 5).map((item, i) => (
                                    <div key={i} className="text-xs text-red-600 font-mono truncate">
                                        {item.url} — {item.reason}
                                    </div>
                                ))}
                                {validation.invalid.length > 5 && (
                                    <div className="text-xs text-muted-foreground">
                                        ... 还有 {validation.invalid.length - 5} 条无效
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* 区域3：执行操作栏 */}
                <div className="flex items-center justify-between p-4 rounded-lg border bg-background sticky bottom-4">
                    <Button variant="outline" onClick={handleClear} disabled={!urlInput && !currentJob}>
                        清空
                    </Button>
                    <Button
                        onClick={handleIngest}
                        disabled={isSubmitting || !validation?.valid.length || !effectivePoolId}
                        className="min-w-[140px]"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                开始采集
                                <ArrowRight className="h-4 w-4 ml-2" />
                            </>
                        )}
                    </Button>
                </div>

                {/* 区域4：结果列表 */}
                {currentJob && (
                    <div className="rounded-lg border bg-background overflow-hidden animate-in slide-in-from-bottom-2">
                        {/* Header */}
                        <div className="p-4 border-b bg-muted/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    {currentJob.status === "DONE" && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                                    {currentJob.status === "RUNNING" && <Loader2 className="h-5 w-5 animate-spin text-blue-500" />}
                                    {currentJob.status === "PARTIAL_FAILED" && <AlertCircle className="h-5 w-5 text-amber-500" />}
                                    {currentJob.status === "QUEUED" && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
                                    <div>
                                        <div className="font-medium">
                                            {currentJob.status === "DONE" ? "采集完成" :
                                                currentJob.status === "RUNNING" ? "正在采集..." :
                                                    currentJob.status === "PARTIAL_FAILED" ? "部分失败" : "排队中"}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            Job ID: {currentJob.id.slice(0, 8)}...
                                        </div>
                                    </div>
                                </div>
                                <Badge variant="outline">
                                    {currentJob.succeeded}/{currentJob.total}
                                </Badge>
                            </div>

                            {/* Progress bar */}
                            <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-green-500 transition-all duration-300"
                                    style={{ width: `${currentJob.total > 0 ? (currentJob.succeeded / currentJob.total) * 100 : 0}%` }}
                                />
                            </div>
                        </div>

                        {/* Stats */}
                        <div className="grid grid-cols-3 divide-x">
                            <div className="p-4 text-center">
                                <div className="text-2xl font-semibold text-green-600">{currentJob.succeeded}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">成功</div>
                            </div>
                            <div className="p-4 text-center">
                                <div className="text-2xl font-semibold text-amber-600">{currentJob.deduped}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">去重</div>
                            </div>
                            <div className="p-4 text-center">
                                <div className="text-2xl font-semibold text-red-600">{currentJob.failed}</div>
                                <div className="text-xs text-muted-foreground uppercase tracking-wider">失败</div>
                            </div>
                        </div>

                        {/* Failed items */}
                        {currentJob.failures && currentJob.failures.length > 0 && (
                            <div className="border-t p-4 space-y-2">
                                <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">失败详情</div>
                                {currentJob.failures.slice(0, 5).map((f: { url: string; error: string }, i: number) => (
                                    <div key={i} className="flex items-start gap-2 text-xs">
                                        <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 shrink-0" />
                                        <div className="min-w-0">
                                            <div className="font-mono truncate text-muted-foreground">{f.url}</div>
                                            <div className="text-red-600">{f.error}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Actions */}
                        {currentJob.status === "DONE" && (
                            <div className="border-t p-4 flex justify-end gap-2">
                                <Button variant="outline" size="sm" onClick={() => router.push('/content')}>
                                    查看已入库内容
                                    <ExternalLink className="h-3.5 w-3.5 ml-2" />
                                </Button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </PageShell>
    )
}
