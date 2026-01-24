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
import { PageShell } from "@/components/layout/PageShell"
import {
    Plus,
    Trash2,
    Loader2,
    Hash,
    AtSign,
    Search,
    List,
    RefreshCw,
    Settings2,
    TrendingUp,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { format } from "date-fns"

interface Topic {
    id: string
    name: string
    description?: string
    type: string
    query?: string
    hashtags: string[]
    authorHandles: string[]
    xListId?: string
    syncEnabled: boolean
    syncInterval: number
    lastSyncAt?: string
    minLikes: number
    minRetweets: number
    excludeReplies: boolean
    excludeRetweets: boolean
    language?: string
    totalDiscovered: number
    totalImported: number
    isActive: boolean
    _count?: { discoveries: number }
}

const topicTypeConfig = {
    keyword: { icon: Search, label: "关键词", color: "bg-blue-500" },
    hashtag: { icon: Hash, label: "话题标签", color: "bg-purple-500" },
    author: { icon: AtSign, label: "作者", color: "bg-green-500" },
    list: { icon: List, label: "列表", color: "bg-orange-500" },
}

export default function TopicsSettingsPage() {
    const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

    const [topics, setTopics] = useState<Topic[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [editingTopic, setEditingTopic] = useState<Topic | null>(null)

    // Form state
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        type: "keyword",
        query: "",
        hashtags: "",
        authorHandles: "",
        syncEnabled: true,
        syncInterval: 60,
        minLikes: 10,
        minRetweets: 0,
        excludeReplies: true,
        excludeRetweets: true,
        language: "zh",
    })

    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    // Load topics
    useEffect(() => {
        if (!currentWorkspaceId) return

        setIsLoading(true)
        fetch(`/api/topics?workspaceId=${currentWorkspaceId}`)
            .then((res) => res.json())
            .then((data) => setTopics(data.topics || []))
            .catch(console.error)
            .finally(() => setIsLoading(false))
    }, [currentWorkspaceId])

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            type: "keyword",
            query: "",
            hashtags: "",
            authorHandles: "",
            syncEnabled: true,
            syncInterval: 60,
            minLikes: 10,
            minRetweets: 0,
            excludeReplies: true,
            excludeRetweets: true,
            language: "zh",
        })
    }

    const handleCreate = async () => {
        if (!currentWorkspaceId || !formData.name) return

        setIsLoading(true)
        try {
            const res = await fetch("/api/topics", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    ...formData,
                    hashtags: formData.hashtags.split(",").map((h) => h.trim()).filter(Boolean),
                    authorHandles: formData.authorHandles.split(",").map((a) => a.trim()).filter(Boolean),
                }),
            })

            if (res.ok) {
                const data = await res.json()
                setTopics((prev) => [data.topic, ...prev])
                setShowCreateDialog(false)
                resetForm()
            }
        } catch (error) {
            console.error("Failed to create topic:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleUpdate = async () => {
        if (!editingTopic) return

        setIsLoading(true)
        try {
            const res = await fetch(`/api/topics/${editingTopic.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    hashtags: formData.hashtags.split(",").map((h) => h.trim()).filter(Boolean),
                    authorHandles: formData.authorHandles.split(",").map((a) => a.trim()).filter(Boolean),
                }),
            })

            if (res.ok) {
                const data = await res.json()
                setTopics((prev) =>
                    prev.map((t) => (t.id === editingTopic.id ? data.topic : t))
                )
                setEditingTopic(null)
                resetForm()
            }
        } catch (error) {
            console.error("Failed to update topic:", error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("确定删除此话题？相关发现内容也会被删除。")) return

        try {
            const res = await fetch(`/api/topics/${id}`, { method: "DELETE" })
            if (res.ok) {
                setTopics((prev) => prev.filter((t) => t.id !== id))
            }
        } catch (error) {
            console.error("Failed to delete topic:", error)
        }
    }

    const handleToggleActive = async (topic: Topic) => {
        try {
            const res = await fetch(`/api/topics/${topic.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isActive: !topic.isActive }),
            })

            if (res.ok) {
                setTopics((prev) =>
                    prev.map((t) =>
                        t.id === topic.id ? { ...t, isActive: !t.isActive } : t
                    )
                )
            }
        } catch (error) {
            console.error("Failed to toggle topic:", error)
        }
    }

    const openEditDialog = (topic: Topic) => {
        setEditingTopic(topic)
        setFormData({
            name: topic.name,
            description: topic.description || "",
            type: topic.type,
            query: topic.query || "",
            hashtags: (topic.hashtags || []).join(", "),
            authorHandles: (topic.authorHandles || []).join(", "),
            syncEnabled: topic.syncEnabled,
            syncInterval: topic.syncInterval,
            minLikes: topic.minLikes,
            minRetweets: topic.minRetweets,
            excludeReplies: topic.excludeReplies,
            excludeRetweets: topic.excludeRetweets,
            language: topic.language || "zh",
        })
    }

    const TopicForm = () => (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>话题名称</Label>
                    <Input
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="例：AI 技术动态"
                    />
                </div>
                <div className="space-y-2">
                    <Label>类型</Label>
                    <Select
                        value={formData.type}
                        onValueChange={(v: string) => setFormData({ ...formData, type: v })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="keyword">关键词搜索</SelectItem>
                            <SelectItem value="hashtag">话题标签</SelectItem>
                            <SelectItem value="author">关注作者</SelectItem>
                            <SelectItem value="list">X 列表</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="space-y-2">
                <Label>描述</Label>
                <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="话题描述（可选）"
                    rows={2}
                />
            </div>

            {formData.type === "keyword" && (
                <div className="space-y-2">
                    <Label>搜索关键词</Label>
                    <Input
                        value={formData.query}
                        onChange={(e) => setFormData({ ...formData, query: e.target.value })}
                        placeholder="例：AI agent OR LLM"
                    />
                </div>
            )}

            {formData.type === "hashtag" && (
                <div className="space-y-2">
                    <Label>话题标签（逗号分隔）</Label>
                    <Input
                        value={formData.hashtags}
                        onChange={(e) => setFormData({ ...formData, hashtags: e.target.value })}
                        placeholder="例：AI, GPT, LLM"
                    />
                </div>
            )}

            {formData.type === "author" && (
                <div className="space-y-2">
                    <Label>作者用户名（逗号分隔）</Label>
                    <Input
                        value={formData.authorHandles}
                        onChange={(e) => setFormData({ ...formData, authorHandles: e.target.value })}
                        placeholder="例：elonmusk, sama, karpathy"
                    />
                </div>
            )}

            <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-medium">过滤条件</h4>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>最低点赞数</Label>
                        <Input
                            type="number"
                            value={formData.minLikes}
                            onChange={(e) => setFormData({ ...formData, minLikes: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label>最低转发数</Label>
                        <Input
                            type="number"
                            value={formData.minRetweets}
                            onChange={(e) => setFormData({ ...formData, minRetweets: parseInt(e.target.value) || 0 })}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-between">
                    <Label>排除回复</Label>
                    <Switch
                        checked={formData.excludeReplies}
                        onCheckedChange={(v: boolean) => setFormData({ ...formData, excludeReplies: v })}
                    />
                </div>

                <div className="flex items-center justify-between">
                    <Label>排除转发</Label>
                    <Switch
                        checked={formData.excludeRetweets}
                        onCheckedChange={(v: boolean) => setFormData({ ...formData, excludeRetweets: v })}
                    />
                </div>
            </div>

            <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-medium">同步设置</h4>
                <div className="flex items-center justify-between">
                    <Label>启用自动同步</Label>
                    <Switch
                        checked={formData.syncEnabled}
                        onCheckedChange={(v: boolean) => setFormData({ ...formData, syncEnabled: v })}
                    />
                </div>

                <div className="space-y-2">
                    <Label>同步间隔（分钟）</Label>
                    <Select
                        value={formData.syncInterval.toString()}
                        onValueChange={(v: string) => setFormData({ ...formData, syncInterval: parseInt(v) })}
                    >
                        <SelectTrigger>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="15">15 分钟</SelectItem>
                            <SelectItem value="30">30 分钟</SelectItem>
                            <SelectItem value="60">1 小时</SelectItem>
                            <SelectItem value="180">3 小时</SelectItem>
                            <SelectItem value="360">6 小时</SelectItem>
                            <SelectItem value="720">12 小时</SelectItem>
                            <SelectItem value="1440">24 小时</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    )

    return (
        <PageShell
            title="话题订阅"
            description="管理内容发现的话题订阅"
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
                    添加话题
                </Button>
            }
        >
            <div className="space-y-4">
                {isLoading && topics.length === 0 ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                    </div>
                ) : topics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                        <TrendingUp className="h-12 w-12 mb-4 opacity-20" />
                        <p className="text-sm">暂无话题订阅</p>
                        <p className="text-xs mt-1">添加话题开始发现热门内容</p>
                        <Button
                            size="sm"
                            className="mt-4"
                            onClick={() => {
                                resetForm()
                                setShowCreateDialog(true)
                            }}
                        >
                            <Plus className="h-3.5 w-3.5 mr-1.5" />
                            添加话题
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {topics.map((topic) => {
                            const typeConfig = topicTypeConfig[topic.type as keyof typeof topicTypeConfig] || topicTypeConfig.keyword
                            const TypeIcon = typeConfig.icon

                            return (
                                <div
                                    key={topic.id}
                                    className={cn(
                                        "border rounded-lg p-4 space-y-3 transition-all",
                                        !topic.isActive && "opacity-50"
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("p-1.5 rounded", typeConfig.color)}>
                                                <TypeIcon className="h-3.5 w-3.5 text-white" />
                                            </div>
                                            <div>
                                                <h3 className="font-medium text-sm">{topic.name}</h3>
                                                <p className="text-xs text-muted-foreground">
                                                    {typeConfig.label}
                                                </p>
                                            </div>
                                        </div>
                                        <Switch
                                            checked={topic.isActive}
                                            onCheckedChange={() => handleToggleActive(topic)}
                                        />
                                    </div>

                                    {topic.description && (
                                        <p className="text-xs text-muted-foreground line-clamp-2">
                                            {topic.description}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                        <Badge variant="secondary" className="text-[10px]">
                                            发现 {topic._count?.discoveries || topic.totalDiscovered}
                                        </Badge>
                                        <Badge variant="outline" className="text-[10px]">
                                            导入 {topic.totalImported}
                                        </Badge>
                                    </div>

                                    {topic.lastSyncAt && (
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                            <RefreshCw className="h-3 w-3" />
                                            上次同步: {format(new Date(topic.lastSyncAt), "MM/dd HH:mm")}
                                        </p>
                                    )}

                                    <div className="flex items-center gap-2 pt-2 border-t">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs flex-1"
                                            onClick={() => openEditDialog(topic)}
                                        >
                                            <Settings2 className="h-3 w-3 mr-1" />
                                            设置
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-7 text-xs text-destructive hover:text-destructive"
                                            onClick={() => handleDelete(topic.id)}
                                        >
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>

            {/* Create Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>添加话题</DialogTitle>
                        <DialogDescription>
                            创建新的话题订阅，自动发现相关热门内容
                        </DialogDescription>
                    </DialogHeader>

                    <TopicForm />

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
            <Dialog open={!!editingTopic} onOpenChange={(open) => !open && setEditingTopic(null)}>
                <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>编辑话题</DialogTitle>
                        <DialogDescription>
                            修改话题订阅设置
                        </DialogDescription>
                    </DialogHeader>

                    <TopicForm />

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditingTopic(null)}>
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
