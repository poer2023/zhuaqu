"use client"

import { useEffect, useState } from "react"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import {
    RefreshCw,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Clock,
    FileText,
    Zap,
    TrendingUp,
    ArrowRight,
} from "lucide-react"

// ==================== Types ====================

type DashboardData = {
    jobs: {
        total: number
        byStatus: Record<string, number>
        byType: Record<string, number>
    }
    steps: {
        total: number
        byStatus: Record<string, number>
        byType: Record<string, number>
        avgDurationMs: number | null
    }
    recentFailures: Array<{
        id: string
        jobId: string
        type: string
        status: string
        error: string | null
        createdAt: string
    }>
    ingestJobs: {
        total: number
        succeeded: number
        failed: number
        running: number
    }
    contentItems: {
        total: number
        byStatus: Record<string, number>
    }
    lastUpdated: string
}

// ==================== Components ====================

function StatCard({
    title,
    value,
    subtitle,
    icon: Icon,
    trend,
    href,
}: {
    title: string
    value: string | number
    subtitle?: string
    icon: React.ElementType
    trend?: "up" | "down" | "neutral"
    href?: string
}) {
    const content = (
        <div className="rounded-xl border bg-card p-5 hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between">
                <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">{title}</p>
                    <p className="text-3xl font-bold tracking-tight">{value}</p>
                    {subtitle && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {trend === "up" && <TrendingUp className="h-3 w-3 text-green-500" />}
                            {trend === "down" && <TrendingUp className="h-3 w-3 text-red-500 rotate-180" />}
                            {subtitle}
                        </p>
                    )}
                </div>
                <div className="rounded-lg bg-primary/10 p-2.5">
                    <Icon className="h-5 w-5 text-primary" />
                </div>
            </div>
        </div>
    )

    if (href) {
        return <Link href={href}>{content}</Link>
    }
    return content
}

function StatusDistribution({
    title,
    data,
    colorMap,
}: {
    title: string
    data: Record<string, number>
    colorMap: Record<string, string>
}) {
    const total = Object.values(data).reduce((a, b) => a + b, 0)
    if (total === 0) return null

    return (
        <div className="rounded-xl border bg-card p-5">
            <h3 className="text-sm font-medium mb-4">{title}</h3>
            <div className="space-y-3">
                {Object.entries(data).map(([status, count]) => {
                    const percentage = Math.round((count / total) * 100)
                    return (
                        <div key={status} className="space-y-1">
                            <div className="flex items-center justify-between text-xs">
                                <span className="flex items-center gap-2">
                                    <span
                                        className="w-2 h-2 rounded-full"
                                        style={{ backgroundColor: colorMap[status] || "#888" }}
                                    />
                                    {status}
                                </span>
                                <span className="text-muted-foreground">
                                    {count} ({percentage}%)
                                </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full rounded-full transition-all duration-500"
                                    style={{
                                        width: `${percentage}%`,
                                        backgroundColor: colorMap[status] || "#888",
                                    }}
                                />
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}

function RecentFailures({
    failures,
}: {
    failures: DashboardData["recentFailures"]
}) {
    if (failures.length === 0) {
        return (
            <div className="rounded-xl border bg-card p-5">
                <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    最近失败
                </h3>
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <CheckCircle2 className="h-8 w-8 mb-2 text-green-500" />
                    <p className="text-sm">无失败任务 🎉</p>
                </div>
            </div>
        )
    }

    return (
        <div className="rounded-xl border bg-card p-5">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-red-500" />
                    最近失败 ({failures.length})
                </h3>
                <Link href="/jobs?status=FAILED">
                    <Button variant="ghost" size="sm" className="h-7 text-xs">
                        查看全部 <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                </Link>
            </div>
            <div className="space-y-2">
                {failures.slice(0, 5).map((failure) => (
                    <Link
                        key={failure.id}
                        href={`/jobs/${failure.jobId}`}
                        className="block p-3 rounded-lg border bg-red-50/50 dark:bg-red-900/10 hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[10px] h-5 px-2 text-red-600 border-red-200">
                                    {failure.type}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                                    {failure.error || "Unknown error"}
                                </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                                {new Date(failure.createdAt).toLocaleString()}
                            </span>
                        </div>
                    </Link>
                ))}
            </div>
        </div>
    )
}

// ==================== Color Maps ====================

const JOB_STATUS_COLORS: Record<string, string> = {
    PENDING: "#f59e0b",
    RUNNING: "#3b82f6",
    PAUSED: "#8b5cf6",
    FAILED: "#ef4444",
    DONE: "#22c55e",
    CANCELED: "#6b7280",
}

const STEP_STATUS_COLORS: Record<string, string> = {
    QUEUED: "#f59e0b",
    RUNNING: "#3b82f6",
    SUCCEEDED: "#22c55e",
    FAILED: "#ef4444",
    SKIPPED: "#6b7280",
}

// ==================== Main Page ====================

export default function DashboardPage() {
    const [data, setData] = useState<DashboardData | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const fetchData = async () => {
        setIsLoading(true)
        setError(null)
        try {
            const res = await fetch("/api/dashboard")
            if (!res.ok) throw new Error("Failed to fetch dashboard data")
            const json = await res.json()
            setData(json)
        } catch (e) {
            setError(String(e))
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchData, 30000)
        return () => clearInterval(interval)
    }, [])

    const successRate = data?.steps.byStatus
        ? Math.round(
            ((data.steps.byStatus.SUCCEEDED || 0) /
                Math.max(1, (data.steps.byStatus.SUCCEEDED || 0) + (data.steps.byStatus.FAILED || 0))) *
            100
        )
        : 0

    return (
        <PageShell
            title="Dashboard"
            description="系统运行状态总览"
            headerAction={
                <Button
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={fetchData}
                    disabled={isLoading}
                >
                    {isLoading ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    ) : (
                        <RefreshCw className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    )}
                    刷新
                </Button>
            }
        >
            {error ? (
                <div className="p-4 rounded-lg border border-red-200 bg-red-50/50 text-red-700 text-sm">
                    {error}
                </div>
            ) : !data ? (
                <div className="h-64 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-6">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                            title="总任务数"
                            value={data.jobs.total}
                            subtitle={`运行中: ${data.jobs.byStatus.RUNNING || 0}`}
                            icon={Zap}
                            href="/jobs"
                        />
                        <StatCard
                            title="内容条目"
                            value={data.contentItems.total}
                            subtitle={`已发布: ${data.contentItems.byStatus.PUBLISHED || 0}`}
                            icon={FileText}
                            href="/content"
                        />
                        <StatCard
                            title="Steps 成功率"
                            value={`${successRate}%`}
                            subtitle={`总计: ${data.steps.total}`}
                            icon={CheckCircle2}
                            trend={successRate > 90 ? "up" : successRate < 70 ? "down" : "neutral"}
                        />
                        <StatCard
                            title="平均处理时长"
                            value={
                                data.steps.avgDurationMs
                                    ? `${Math.round(data.steps.avgDurationMs / 1000)}s`
                                    : "N/A"
                            }
                            subtitle="每个 Step 平均耗时"
                            icon={Clock}
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <StatusDistribution
                            title="Job 状态分布"
                            data={data.jobs.byStatus}
                            colorMap={JOB_STATUS_COLORS}
                        />
                        <StatusDistribution
                            title="Step 状态分布"
                            data={data.steps.byStatus}
                            colorMap={STEP_STATUS_COLORS}
                        />
                    </div>

                    {/* Recent Failures */}
                    <RecentFailures failures={data.recentFailures} />

                    {/* Footer */}
                    <div className="text-xs text-muted-foreground text-center pt-4">
                        最后更新: {new Date(data.lastUpdated).toLocaleString()}
                    </div>
                </div>
            )}
        </PageShell>
    )
}
