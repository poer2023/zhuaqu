"use client"

import { useState, useMemo } from "react"
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    isToday,
    addMonths,
    subMonths,
    addWeeks,
    subWeeks,
    parseISO,
} from "date-fns"
import { zhCN } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    ChevronLeft,
    ChevronRight,
    Calendar as CalendarIcon,
    Clock,
    CheckCircle2,
    XCircle,
    AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"

export interface PublishJob {
    id: string
    status: "QUEUED" | "PUBLISHED" | "FAILED" | "NOT_PUBLISHED"
    mode: string
    scheduledAt?: string | null
    createdAt: string
    completedAt?: string | null
    lastError?: string | null
    rewriteVersion?: {
        output: { text: string }
    }
    publishResults?: Array<{
        tweetUrl: string
    }>
}

interface CalendarViewProps {
    jobs: PublishJob[]
    onJobClick?: (job: PublishJob) => void
    onSlotClick?: (date: Date) => void
    onReschedule?: (jobId: string, newDate: Date) => void
    className?: string
}

type ViewMode = "month" | "week"

const statusConfig = {
    QUEUED: {
        color: "bg-blue-500",
        icon: Clock,
        label: "待发布",
    },
    PUBLISHED: {
        color: "bg-green-500",
        icon: CheckCircle2,
        label: "已发布",
    },
    FAILED: {
        color: "bg-red-500",
        icon: XCircle,
        label: "失败",
    },
    NOT_PUBLISHED: {
        color: "bg-gray-400",
        icon: AlertCircle,
        label: "未发布",
    },
}

export function CalendarView({
    jobs,
    onJobClick,
    onSlotClick,
    className,
}: CalendarViewProps) {
    const [currentDate, setCurrentDate] = useState(new Date())
    const [viewMode, setViewMode] = useState<ViewMode>("month")

    // Group jobs by date
    const jobsByDate = useMemo(() => {
        const grouped = new Map<string, PublishJob[]>()

        jobs.forEach((job) => {
            const dateKey = job.scheduledAt
                ? format(parseISO(job.scheduledAt), "yyyy-MM-dd")
                : job.completedAt
                ? format(parseISO(job.completedAt), "yyyy-MM-dd")
                : format(parseISO(job.createdAt), "yyyy-MM-dd")

            if (!grouped.has(dateKey)) {
                grouped.set(dateKey, [])
            }
            grouped.get(dateKey)!.push(job)
        })

        return grouped
    }, [jobs])

    // Calculate days to display
    const days = useMemo(() => {
        if (viewMode === "month") {
            const monthStart = startOfMonth(currentDate)
            const monthEnd = endOfMonth(currentDate)
            const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 })
            const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
            return eachDayOfInterval({ start: calendarStart, end: calendarEnd })
        } else {
            const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 })
            const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 })
            return eachDayOfInterval({ start: weekStart, end: weekEnd })
        }
    }, [currentDate, viewMode])

    const navigate = (direction: "prev" | "next") => {
        if (viewMode === "month") {
            setCurrentDate(direction === "prev" ? subMonths(currentDate, 1) : addMonths(currentDate, 1))
        } else {
            setCurrentDate(direction === "prev" ? subWeeks(currentDate, 1) : addWeeks(currentDate, 1))
        }
    }

    const goToToday = () => {
        setCurrentDate(new Date())
    }

    const weekDays = ["一", "二", "三", "四", "五", "六", "日"]

    return (
        <div className={cn("flex flex-col", className)}>
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={goToToday}>
                        今天
                    </Button>
                    <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("prev")}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("next")}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                    <h2 className="text-lg font-semibold">
                        {format(currentDate, viewMode === "month" ? "yyyy年 M月" : "yyyy年 M月 第W周", { locale: zhCN })}
                    </h2>
                </div>

                <div className="flex items-center gap-2">
                    {/* View mode toggle */}
                    <div className="flex items-center bg-muted rounded-lg p-0.5">
                        <Button
                            variant={viewMode === "month" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode("month")}
                        >
                            月
                        </Button>
                        <Button
                            variant={viewMode === "week" ? "secondary" : "ghost"}
                            size="sm"
                            className="h-7 text-xs px-3"
                            onClick={() => setViewMode("week")}
                        >
                            周
                        </Button>
                    </div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="border rounded-lg overflow-hidden">
                {/* Week day headers */}
                <div className="grid grid-cols-7 bg-muted/50">
                    {weekDays.map((day) => (
                        <div
                            key={day}
                            className="py-2 text-center text-xs font-medium text-muted-foreground border-b"
                        >
                            {day}
                        </div>
                    ))}
                </div>

                {/* Days grid */}
                <div className={cn(
                    "grid grid-cols-7",
                    viewMode === "week" ? "min-h-[300px]" : ""
                )}>
                    {days.map((day, index) => {
                        const dateKey = format(day, "yyyy-MM-dd")
                        const dayJobs = jobsByDate.get(dateKey) || []
                        const isCurrentMonth = isSameMonth(day, currentDate)
                        const isCurrentDay = isToday(day)

                        return (
                            <div
                                key={index}
                                className={cn(
                                    "min-h-[100px] border-b border-r p-1 transition-colors",
                                    !isCurrentMonth && "bg-muted/30",
                                    isCurrentDay && "bg-blue-50/50 dark:bg-blue-950/20",
                                    "hover:bg-muted/20 cursor-pointer",
                                    viewMode === "week" && "min-h-[200px]"
                                )}
                                onClick={() => onSlotClick?.(day)}
                            >
                                {/* Day number */}
                                <div className="flex items-center justify-between mb-1">
                                    <span
                                        className={cn(
                                            "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                                            isCurrentDay && "bg-primary text-primary-foreground",
                                            !isCurrentMonth && "text-muted-foreground/50"
                                        )}
                                    >
                                        {format(day, "d")}
                                    </span>
                                    {dayJobs.length > 0 && (
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1">
                                            {dayJobs.length}
                                        </Badge>
                                    )}
                                </div>

                                {/* Jobs for this day */}
                                <div className="space-y-0.5">
                                    {dayJobs.slice(0, viewMode === "week" ? 5 : 3).map((job) => {
                                        const config = statusConfig[job.status]
                                        const StatusIcon = config.icon

                                        return (
                                            <div
                                                key={job.id}
                                                className={cn(
                                                    "flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] truncate",
                                                    "hover:ring-1 hover:ring-primary/50 cursor-pointer transition-all",
                                                    job.status === "QUEUED" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                                                    job.status === "PUBLISHED" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                                                    job.status === "FAILED" && "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                                )}
                                                onClick={(e) => {
                                                    e.stopPropagation()
                                                    onJobClick?.(job)
                                                }}
                                            >
                                                <StatusIcon className="h-2.5 w-2.5 shrink-0" />
                                                <span className="truncate">
                                                    {job.scheduledAt && format(parseISO(job.scheduledAt), "HH:mm")}
                                                    {" "}
                                                    {(job.rewriteVersion?.output as { text: string })?.text?.slice(0, 20) || "..."}
                                                </span>
                                            </div>
                                        )
                                    })}
                                    {dayJobs.length > (viewMode === "week" ? 5 : 3) && (
                                        <div className="text-[9px] text-muted-foreground pl-1">
                                            +{dayJobs.length - (viewMode === "week" ? 5 : 3)} 更多
                                        </div>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                    <span>待发布</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>已发布</span>
                </div>
                <div className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>失败</span>
                </div>
            </div>
        </div>
    )
}
