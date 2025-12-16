"use client"

import { useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    type LucideIcon,
    FileText,
    Search,
    Inbox,
    PenTool,
    Send,
    Tag,
    Calendar,
    ArrowRight,
    Loader2
} from "lucide-react"
import { format } from "date-fns"
import { PageShell } from "@/components/layout/PageShell"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useAuditStore } from "@/stores/auditStore"
import { useTranslations } from "@/stores/localeStore"

const actionConfig: Record<string, { label: string, icon: LucideIcon, color: string }> = {
    INGEST_CREATED: { label: "Ingest Created", icon: Inbox, color: "text-blue-500" },
    INGEST_COMPLETED: { label: "Ingest Completed", icon: Inbox, color: "text-green-500" },
    INGEST_FAILED: { label: "Ingest Failed", icon: Inbox, color: "text-red-500" },
    REWRITE_CREATED: { label: "Rewrite Created", icon: PenTool, color: "text-blue-500" },
    REWRITE_GENERATED: { label: "Rewrite Generated", icon: PenTool, color: "text-blue-500" },
    REWRITE_APPROVED: { label: "Rewrite Approved", icon: PenTool, color: "text-green-500" },
    REWRITE_REJECTED: { label: "Rewrite Rejected", icon: PenTool, color: "text-red-500" },
    REWRITE_REWORK: { label: "Rewrite Rework", icon: PenTool, color: "text-amber-500" },
    PUBLISH_QUEUED: { label: "Publish Queued", icon: Send, color: "text-blue-500" },
    PUBLISH_SUCCEEDED: { label: "Publish Success", icon: Send, color: "text-green-500" },
    PUBLISH_FAILED: { label: "Publish Failed", icon: Send, color: "text-red-500" },
    ITEM_MOVED: { label: "Item Moved", icon: FileText, color: "text-purple-500" },
    ITEM_DELETED: { label: "Item Deleted", icon: FileText, color: "text-red-500" },
    ITEM_TAGGED: { label: "Tagged", icon: Tag, color: "text-purple-500" },
}

export default function AuditPage() {
    const { t } = useTranslations()
    const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const { logs, pageInfo, isLoading, actionFilter, fetchLogs, setActionFilter } = useAuditStore()

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    useEffect(() => {
        if (currentWorkspaceId) {
            fetchLogs(currentWorkspaceId)
        }
    }, [currentWorkspaceId, actionFilter, fetchLogs])

    const handleFilterChange = (value: string) => {
        setActionFilter(value === "all" ? null : value)
    }

    return (
        <PageShell
            title={t.audit.title}
            description={t.audit.description}
            headerAction={
                <Button variant="outline" size="sm" className="h-8 text-xs">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" strokeWidth={1.5} />
                    {t.common.export}
                </Button>
            }
        >
            <div className="space-y-4">
                {/* Filters */}
                <div className="flex items-center gap-3">
                    <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" strokeWidth={1.5} />
                        <Input
                            placeholder="Search logs..."
                            className="pl-8 h-8 bg-transparent border-border/60 hover:border-border transition-colors text-sm"
                        />
                    </div>
                    <Select value={actionFilter || "all"} onValueChange={handleFilterChange}>
                        <SelectTrigger className="w-[150px] h-8 bg-transparent border-border/60 text-xs">
                            <SelectValue placeholder="Action" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Actions</SelectItem>
                            <SelectItem value="INGEST_CREATED">Ingest Created</SelectItem>
                            <SelectItem value="INGEST_COMPLETED">Ingest Completed</SelectItem>
                            <SelectItem value="REWRITE_APPROVED">Rewrite Approved</SelectItem>
                            <SelectItem value="PUBLISH_SUCCEEDED">Publish Success</SelectItem>
                            <SelectItem value="PUBLISH_FAILED">Publish Failed</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {/* List */}
                <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                            <p className="text-sm">No audit logs found</p>
                            <p className="text-xs mt-1">Actions will be recorded as you use the system</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-border/40">
                            {logs.map(log => {
                                const config = actionConfig[log.action] || { label: log.action, icon: FileText, color: "text-slate-500" }
                                const Icon = config.icon

                                return (
                                    <div key={log.id} className="flex items-center gap-3 px-3 py-3 hover:bg-muted/40 transition-colors group">
                                        <div className={`p-1.5 rounded-md bg-background/50 border ${config.color}`}>
                                            <Icon className="h-3.5 w-3.5" strokeWidth={1.5} />
                                        </div>

                                        <div className="flex-1 min-w-0 grid grid-cols-12 gap-3 items-center">
                                            <div className="col-span-3">
                                                <div className="font-medium text-sm text-foreground/90">{config.label}</div>
                                                <span className="text-[10px] text-muted-foreground">by {log.actor}</span>
                                            </div>

                                            <div className="col-span-7">
                                                <p className="text-sm text-foreground/80 truncate font-mono">
                                                    {log.contentItem?.textOriginal?.slice(0, 60) ||
                                                        JSON.stringify(log.details).slice(0, 60) ||
                                                        "—"}
                                                </p>
                                            </div>

                                            <div className="col-span-2 text-right">
                                                <span className="text-[10px] text-muted-foreground tabular-nums font-medium">
                                                    {format(new Date(log.createdAt), "HH:mm")}
                                                </span>
                                            </div>
                                        </div>

                                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowRight className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                                        </Button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </div>

                {/* Pagination Info */}
                {pageInfo && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>{pageInfo.total} logs total</span>
                        <span>Page {pageInfo.page} of {pageInfo.totalPages}</span>
                    </div>
                )}
            </div>
        </PageShell>
    )
}
