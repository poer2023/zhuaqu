"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { PageShell } from "@/components/layout/PageShell"
import {
    Plus,
    Trash2,
    Loader2,
    RefreshCw,
    Settings2,
    Repeat,
    Zap,
    BarChart3,
    Clock,
    Play,
    Pause,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { format } from "date-fns"

interface EvergreenQueue {
    id: string
    name: string
    description?: string
    isActive: boolean
    cycleInterval: number
    maxReposts: number
    randomizeOrder: boolean
    variationEnabled: boolean
    totalItems: number
    totalReposts: number
    createdAt: string
    _count?: { items: number }
}

export default function AutomationPage() {
    const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

    const [queues, setQueues] = useState<EvergreenQueue[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [editingQueue, setEditingQueue] = useState<EvergreenQueue | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        cycleInterval: 168,
        maxReposts: 5,
        randomizeOrder: true,
        variationEnabled: false,
    })

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    // Load queues
    useEffect(() => {
        if (!currentWorkspaceId) return

        setIsLoading(true)
        fetch(`/api/evergreen?workspaceId=${currentWorkspaceId}`)
            .then((res) => res.json())
            .then((data) => setQueues(data.queues || []))
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [currentWorkspaceId])

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            cycleInterval: 168,
            maxReposts: 5,
            randomizeOrder: true,
            variationEnabled: false,
        })
    }

    const handleCreate = async () => {
        if (!currentWorkspaceId || !formData.name) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/evergreen", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    ...formData,
                }),
            })

            if (res.ok) {
                const data = await res.json()
                setQueues((prev) => [data.queue, ...prev])
                setShowCreateDialog(false)
                resetForm()
            }
        } catch (error) {
            console.error("Failed to create queue:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingQueue) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/evergreen/${editingQueue.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            })

            if (res.ok) {
                const data = await res.json()
                setQueues((prev) =>
                    prev.map((q) => (q.id === editingQueue.id ? data.queue : q))
                )
                setEditingQueue(null)
                resetForm()
            }
        } catch (error) {
            console.error("Failed to update queue:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("确定删除此常青队列？队列中的所有内容都会被删除。")) return

        try {
            const res = await fetch(`/api/evergreen/${id}`, { method: "DELETE" })
            if (res.ok) {
                setQueues((prev) => prev.filter((q) => q.id !== id))
            }
        } catch (error) {
            console.error("Failed to delete queue:", error)
        }
    }

    const handleToggleActive = async (queue: EvergreenQueue) => {
        try {
            const res = await fetch(`/api/evergreen/${queue.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !queue.isActive }),
            })

            if (res.ok) {
                setQueues((prev) =>
                    prev.map((q) =>
                        q.id === queue.id ? { ...q, isActive: !q.isActive } : q
                    )
                )
            }
        } catch (error) {
            console.error("Failed to toggle queue:", error)
        }
    }

    const openEditDialog = (queue: EvergreenQueue) => {
        setEditingQueue(queue)
        setFormData({
            name: queue.name,
            description: queue.description || "",
            cycleInterval: queue.cycleInterval,
            maxReposts: queue.maxReposts,
            randomizeOrder: queue.randomizeOrder,
            variationEnabled: queue.variationEnabled,
        })
    }

    const formatCycleInterval = (hours: number) => {
        if (hours < 24) return `${hours} 小时`
        const days = Math.floor(hours / 24)
        return `${days} 天`
    }

    const QueueForm = () => (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label>队列名称</Label>
                <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="例：每周精选推文"
                />
            </div>

            <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="队列描述（可选）"
                    rows={2}
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>循环间隔</Label>
                    <Select
                        value={formData.cycleInterval.toString()}
                        onValueChange={(v: string) => setFormData({ ...formData, cycleInterval: parseInt(v) })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="24">1 天</SelectItem>
                            <SelectItem value="72">3 天</SelectItem>
                            <SelectItem value="168">7 天</SelectItem>
                            <SelectItem value="336">14 天</SelectItem>
                            <SelectItem value="720">30 天</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>最大重发次数</Label>
                    <Select
                        value={formData.maxReposts.toString()}
                        onValueChange={(v: string) => setFormData({ ...formData, maxReposts: parseInt(v) })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="3">3 次</SelectItem>
                            <SelectItem value="5">5 次</SelectItem>
                            <SelectItem value="10">10 次</SelectItem>
                            <SelectItem value="0">无限制</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="border-t pt-4 space-y-4">
                <div className="flex items-center justify-between">
                    <div>
                        <Label>随机顺序</Label>
                        <p className="text-xs text-muted-foreground">每次循环时随机选择内容</p>
                    </div>
                    <Switch
                        checked={formData.randomizeOrder}
                        onCheckedChange={(v: boolean) => setFormData({ ...formData, randomizeOrder: v })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <div>
                        <Label>启用变体</Label>
                        <p className="text-xs text-muted-foreground">每次发布时使用不同的 A/B 变体</p>
                    </div>
                    <Switch
                        checked={formData.variationEnabled}
                        onCheckedChange={(v: boolean) => setFormData({ ...formData, variationEnabled: v })}
                    />
                </div>
            </div>
        </div>
    )

    return (
        <PageShell
            title="自动化"
            description="管理常青内容队列和自动化发布"
            headerAction={
                <Button
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => {
                        resetForm()
                        setShowCreateDialog(true)
                    }}
                >
                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                    创建队列
                </Button>
            }
        >
            <div className="space-y-6">
                {/* Feature Cards */}
                <div className="grid gap-4 md:grid-cols-3">
                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Repeat className="h-4 w-4 text-blue-500" />
                                常青队列
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                自动循环发布高表现内容，保持账号活跃度
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Zap className="h-4 w-4 text-yellow-500" />
                                A/B 变体
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                自动生成多个版本，测试最佳表现
                            </p>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm flex items-center gap-2">
                                <BarChart3 className="h-4 w-4 text-green-500" />
                                质量评分
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-muted-foreground">
                                AI 评估内容质量，提供改进建议
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Evergreen Queues */}
                <div className="space-y-4">
                    <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        常青队列
                    </h2>

                    {isLoading && queues.length === 0 ? (
                        <div className="flex items-center justify-center h-32">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : queues.length === 0 ? (
                        <Card className="border-dashed">
                            <CardContent className="flex flex-col items-center justify-center py-8">
                                <Repeat className="h-8 w-8 text-muted-foreground/30 mb-3" />
                                <p className="text-sm text-muted-foreground">暂无常青队列</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                    创建队列来自动循环发布高表现内容
                                </p>
                                <Button
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => {
                                        resetForm()
                                        setShowCreateDialog(true)
                                    }}
                                >
                                    <Plus className="h-3.5 w-3.5 mr-1.5" />
                                    创建队列
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2">
                            {queues.map((queue) => (
                                <Card
                                    key={queue.id}
                                    className={cn(!queue.isActive && "opacity-60")}
                                >
                                    <CardHeader className="pb-2">
                                        <div className="flex items-start justify-between">
                                            <div>
                                                <CardTitle className="text-base flex items-center gap-2">
                                                    {queue.isActive ? (
                                                        <Play className="h-3.5 w-3.5 text-green-500" />
                                                    ) : (
                                                        <Pause className="h-3.5 w-3.5 text-muted-foreground" />
                                                    )}
                                                    {queue.name}
                                                </CardTitle>
                                                {queue.description && (
                                                    <CardDescription className="mt-1">
                                                        {queue.description}
                                                    </CardDescription>
                                                )}
                                            </div>
                                            <Switch
                                                checked={queue.isActive}
                                                onCheckedChange={() => handleToggleActive(queue)}
                                            />
                                        </div>
                                    </CardHeader>
                                    <CardContent className="space-y-3">
                                        <div className="flex items-center gap-2 text-xs">
                                            <Badge variant="secondary">
                                                {queue._count?.items || queue.totalItems} 条内容
                                            </Badge>
                                            <Badge variant="outline">
                                                已发布 {queue.totalReposts} 次
                                            </Badge>
                                        </div>

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" />
                                                每 {formatCycleInterval(queue.cycleInterval)} 循环
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <RefreshCw className="h-3 w-3" />
                                                最多 {queue.maxReposts} 次
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 pt-2 border-t">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs flex-1"
                                                onClick={() => openEditDialog(queue)}
                                            >
                                                <Settings2 className="h-3 w-3 mr-1" />
                                                设置
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-destructive hover:text-destructive"
                                                onClick={() => handleDelete(queue.id)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>创建常青队列</DialogTitle>
                        <DialogDescription>
                            设置自动循环发布的内容队列
                        </DialogDescription>
                    </DialogHeader>

                    <QueueForm />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                            取消
                        </Button>
                        <Button onClick={handleCreate} disabled={isLoading || !formData.name}>
                            {isLoading && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                            创建
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Edit Dialog */}
            <Dialog open={!!editingQueue} onOpenChange={(open) => !open && setEditingQueue(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>编辑队列</DialogTitle>
                        <DialogDescription>
                            修改常青队列设置
                        </DialogDescription>
                    </DialogHeader>

                    <QueueForm />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingQueue(null)}>
                            取消
                        </Button>
                        <Button onClick={handleUpdate} disabled={isLoading || !formData.name}>
                            {isLoading && <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />}
                            保存
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </PageShell>
    )
}
