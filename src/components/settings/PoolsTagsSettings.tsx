"use client"

import { useEffect, useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Plus, Trash2, Loader2, FolderOpen, Tag } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspaceStore"

interface Pool {
    id: string
    name: string
    _count?: { contentItems: number }
}

interface TagItem {
    id: string
    name: string
    color: string
}

export function PoolsTagsSettings() {
    const { currentWorkspaceId } = useWorkspaceStore()
    const [pools, setPools] = useState<Pool[]>([])
    const [tags, setTags] = useState<TagItem[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [newPoolName, setNewPoolName] = useState("")
    const [newTagName, setNewTagName] = useState("")
    const [newTagColor, setNewTagColor] = useState("#3b82f6")
    const [isCreatingPool, setIsCreatingPool] = useState(false)
    const [isCreatingTag, setIsCreatingTag] = useState(false)

    const fetchData = useCallback(async () => {
        if (!currentWorkspaceId) return
        setIsLoading(true)
        try {
            const [poolsRes, tagsRes] = await Promise.all([
                fetch(`/api/workspaces/${currentWorkspaceId}/pools`),
                fetch(`/api/tags?workspaceId=${currentWorkspaceId}`)
            ])
            if (poolsRes.ok) {
                const poolsData = await poolsRes.json()
                setPools(poolsData.pools || poolsData || [])
            }
            if (tagsRes.ok) {
                const tagsData = await tagsRes.json()
                setTags(tagsData.tags || [])
            }
        } catch (error) {
            console.error("Failed to fetch pools/tags:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspaceId])

    useEffect(() => {
        if (currentWorkspaceId) {
            fetchData()
        }
    }, [currentWorkspaceId, fetchData])

    const handleCreatePool = async () => {
        if (!newPoolName.trim() || !currentWorkspaceId) return
        setIsCreatingPool(true)
        try {
            const res = await fetch(`/api/workspaces/${currentWorkspaceId}/pools`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newPoolName.trim() })
            })
            if (res.ok) {
                setNewPoolName("")
                await fetchData()
            }
        } catch (error) {
            console.error("Failed to create pool:", error)
        } finally {
            setIsCreatingPool(false)
        }
    }

    const handleDeletePool = async (poolId: string) => {
        if (!confirm("确定删除此素材池？池中的内容将被移动到默认池。")) return
        try {
            const res = await fetch(`/api/pools/${poolId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                await fetchData()
            }
        } catch (error) {
            console.error("Failed to delete pool:", error)
        }
    }

    const handleCreateTag = async () => {
        if (!newTagName.trim() || !currentWorkspaceId) return
        setIsCreatingTag(true)
        try {
            const res = await fetch(`/api/tags`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    name: newTagName.trim(),
                    color: newTagColor
                })
            })
            if (res.ok) {
                setNewTagName("")
                await fetchData()
            }
        } catch (error) {
            console.error("Failed to create tag:", error)
        } finally {
            setIsCreatingTag(false)
        }
    }

    const handleDeleteTag = async (tagId: string) => {
        if (!confirm("确定删除此标签？")) return
        try {
            const res = await fetch(`/api/tags/${tagId}`, {
                method: "DELETE"
            })
            if (res.ok) {
                await fetchData()
            }
        } catch (error) {
            console.error("Failed to delete tag:", error)
        }
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Pools Section */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <FolderOpen className="h-4 w-4" />
                        素材池管理
                    </h3>
                    <p className="text-xs text-muted-foreground">创建和管理素材池，用于组织内容</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden">
                    {/* Add New Pool */}
                    <div className="p-3 border-b border-border/40 flex gap-2">
                        <Input
                            placeholder="输入素材池名称..."
                            value={newPoolName}
                            onChange={(e) => setNewPoolName(e.target.value)}
                            className="h-8 text-sm bg-transparent flex-1"
                            onKeyDown={(e) => e.key === "Enter" && handleCreatePool()}
                        />
                        <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={handleCreatePool}
                            disabled={isCreatingPool || !newPoolName.trim()}
                        >
                            {isCreatingPool ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-3 w-3 mr-1" />
                                    添加
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Pool List */}
                    <div className="divide-y divide-border/40">
                        {pools.length === 0 ? (
                            <div className="p-4 text-sm text-muted-foreground text-center">
                                暂无素材池
                            </div>
                        ) : (
                            pools.map((pool) => (
                                <div key={pool.id} className="p-3 flex items-center justify-between hover:bg-muted/30 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <FolderOpen className="h-4 w-4 text-muted-foreground" />
                                        <span className="text-sm font-medium">{pool.name}</span>
                                        <Badge variant="secondary" className="text-[10px] h-5">
                                            {pool._count?.contentItems || 0} 条内容
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500"
                                        onClick={() => handleDeletePool(pool.id)}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Tags Section */}
            <div className="space-y-4">
                <div>
                    <h3 className="text-sm font-medium flex items-center gap-2">
                        <Tag className="h-4 w-4" />
                        标签管理
                    </h3>
                    <p className="text-xs text-muted-foreground">创建标签来分类和筛选内容</p>
                </div>

                <div className="rounded-lg border border-border/60 bg-card/30 overflow-hidden">
                    {/* Add New Tag */}
                    <div className="p-3 border-b border-border/40 flex gap-2">
                        <input
                            type="color"
                            value={newTagColor}
                            onChange={(e) => setNewTagColor(e.target.value)}
                            className="h-8 w-8 rounded border border-border/60 cursor-pointer"
                        />
                        <Input
                            placeholder="输入标签名称..."
                            value={newTagName}
                            onChange={(e) => setNewTagName(e.target.value)}
                            className="h-8 text-sm bg-transparent flex-1"
                            onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                        />
                        <Button
                            size="sm"
                            className="h-8 text-xs"
                            onClick={handleCreateTag}
                            disabled={isCreatingTag || !newTagName.trim()}
                        >
                            {isCreatingTag ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                                <>
                                    <Plus className="h-3 w-3 mr-1" />
                                    添加
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Tag List */}
                    <div className="p-3 flex flex-wrap gap-2">
                        {tags.length === 0 ? (
                            <div className="text-sm text-muted-foreground w-full text-center py-2">
                                暂无标签
                            </div>
                        ) : (
                            tags.map((tag) => (
                                <Badge
                                    key={tag.id}
                                    variant="outline"
                                    className="text-xs py-1 px-2.5 pr-1.5 flex items-center gap-1.5"
                                    style={{
                                        borderColor: tag.color,
                                        color: tag.color,
                                        backgroundColor: `${tag.color}10`
                                    }}
                                >
                                    <span
                                        className="h-2 w-2 rounded-full"
                                        style={{ backgroundColor: tag.color }}
                                    />
                                    {tag.name}
                                    <button
                                        onClick={() => handleDeleteTag(tag.id)}
                                        className="ml-1 p-0.5 rounded hover:bg-red-100 transition-colors"
                                    >
                                        <Trash2 className="h-3 w-3 text-muted-foreground hover:text-red-500" />
                                    </button>
                                </Badge>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}
