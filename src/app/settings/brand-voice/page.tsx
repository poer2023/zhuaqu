"use client"

import { useEffect, useState, useCallback } from "react"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Plus,
    Loader2,
    Sparkles,
    Trash2,
    Star,
    Edit3,
    CheckCircle2,
    AlertCircle,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"

interface BrandVoice {
    id: string
    name: string
    description: string | null
    sampleTweets: string[]
    styleProfile: Record<string, unknown> | null
    systemPrompt: string | null
    isDefault: boolean
    isActive: boolean
    createdAt: string
}

interface StyleProfile {
    tone?: {
        primary?: string
        secondary?: string
        formality?: number
    }
    vocabulary?: {
        complexity?: number
        techTerms?: string[]
        signatures?: string[]
        emoji_usage?: string
    }
    patterns?: {
        sentenceLength?: string
        structure?: string
        hooks?: string[]
        endings?: string[]
    }
    personality?: {
        traits?: string[]
        expertise?: string[]
        values?: string[]
    }
}

export default function BrandVoiceSettingsPage() {
    const { currentWorkspaceId } = useWorkspaceStore()
    const [brandVoices, setBrandVoices] = useState<BrandVoice[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null)
    const [editingId, setEditingId] = useState<string | null>(null)

    // Form state
    const [newName, setNewName] = useState("")
    const [newDescription, setNewDescription] = useState("")
    const [newSamples, setNewSamples] = useState("")
    const [dialogOpen, setDialogOpen] = useState(false)

    const fetchBrandVoices = useCallback(async () => {
        if (!currentWorkspaceId) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/brand-voice?workspaceId=${currentWorkspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setBrandVoices(data.brandVoices || [])
            }
        } catch (error) {
            console.error("Failed to fetch brand voices:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspaceId])

    useEffect(() => {
        fetchBrandVoices()
    }, [fetchBrandVoices])

    const handleCreate = async () => {
        if (!currentWorkspaceId || !newName.trim()) return
        setIsCreating(true)
        try {
            const samples = newSamples
                .split("\n---\n")
                .map(s => s.trim())
                .filter(s => s.length > 0)

            const res = await fetch("/api/brand-voice", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId: currentWorkspaceId,
                    name: newName.trim(),
                    description: newDescription.trim() || null,
                    sampleTweets: samples,
                    isDefault: brandVoices.length === 0,
                }),
            })

            if (res.ok) {
                setNewName("")
                setNewDescription("")
                setNewSamples("")
                setDialogOpen(false)
                await fetchBrandVoices()
            }
        } catch (error) {
            console.error("Failed to create brand voice:", error)
        } finally {
            setIsCreating(false)
        }
    }

    const handleAnalyze = async (id: string) => {
        setIsAnalyzing(id)
        try {
            const res = await fetch(`/api/brand-voice/${id}/analyze`, {
                method: "POST",
            })
            if (res.ok) {
                await fetchBrandVoices()
            }
        } catch (error) {
            console.error("Failed to analyze brand voice:", error)
        } finally {
            setIsAnalyzing(null)
        }
    }

    const handleSetDefault = async (id: string) => {
        try {
            await fetch(`/api/brand-voice/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDefault: true }),
            })
            await fetchBrandVoices()
        } catch (error) {
            console.error("Failed to set default:", error)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("确定要删除这个品牌声音吗？")) return
        try {
            await fetch(`/api/brand-voice/${id}`, { method: "DELETE" })
            await fetchBrandVoices()
        } catch (error) {
            console.error("Failed to delete brand voice:", error)
        }
    }

    const handleUpdateSamples = async (id: string, samples: string[]) => {
        try {
            await fetch(`/api/brand-voice/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sampleTweets: samples }),
            })
            await fetchBrandVoices()
            setEditingId(null)
        } catch (error) {
            console.error("Failed to update samples:", error)
        }
    }

    return (
        <PageShell
            title="品牌声音"
            description="创建和管理您的品牌声音，让AI生成符合您风格的内容"
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">品牌声音库</h2>
                        <p className="text-sm text-muted-foreground">
                            通过示例推文训练AI，生成符合您风格的改写内容
                        </p>
                    </div>
                    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                        <DialogTrigger asChild>
                            <Button>
                                <Plus className="h-4 w-4 mr-2" />
                                创建品牌声音
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>创建品牌声音</DialogTitle>
                                <DialogDescription>
                                    提供5-10条您过去发布的推文作为样本，AI将分析您的写作风格
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                                <div className="space-y-2">
                                    <Label>名称</Label>
                                    <Input
                                        value={newName}
                                        onChange={(e) => setNewName(e.target.value)}
                                        placeholder="例如：专业技术风格"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>描述（可选）</Label>
                                    <Input
                                        value={newDescription}
                                        onChange={(e) => setNewDescription(e.target.value)}
                                        placeholder="简要描述这个声音的特点"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>示例推文</Label>
                                    <p className="text-xs text-muted-foreground">
                                        粘贴5-10条您过去发布的推文，每条之间用 --- 分隔
                                    </p>
                                    <Textarea
                                        value={newSamples}
                                        onChange={(e) => setNewSamples(e.target.value)}
                                        placeholder={`第一条推文内容...\n---\n第二条推文内容...\n---\n第三条推文内容...`}
                                        className="min-h-[200px] font-mono text-sm"
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    取消
                                </Button>
                                <Button onClick={handleCreate} disabled={isCreating || !newName.trim()}>
                                    {isCreating ? (
                                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 创建中...</>
                                    ) : (
                                        "创建"
                                    )}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>

                {/* Loading state */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : brandVoices.length === 0 ? (
                    /* Empty state */
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Sparkles className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="font-medium mb-1">还没有品牌声音</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                创建您的第一个品牌声音，让AI学习您的写作风格
                            </p>
                            <Button onClick={() => setDialogOpen(true)}>
                                <Plus className="h-4 w-4 mr-2" />
                                创建品牌声音
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    /* Brand voice list */
                    <div className="grid gap-4">
                        {brandVoices.map((voice) => (
                            <BrandVoiceCard
                                key={voice.id}
                                voice={voice}
                                isAnalyzing={isAnalyzing === voice.id}
                                isEditing={editingId === voice.id}
                                onAnalyze={() => handleAnalyze(voice.id)}
                                onSetDefault={() => handleSetDefault(voice.id)}
                                onDelete={() => handleDelete(voice.id)}
                                onEdit={() => setEditingId(voice.id)}
                                onCancelEdit={() => setEditingId(null)}
                                onSaveSamples={(samples) => handleUpdateSamples(voice.id, samples)}
                            />
                        ))}
                    </div>
                )}
            </div>
        </PageShell>
    )
}

function BrandVoiceCard({
    voice,
    isAnalyzing,
    isEditing,
    onAnalyze,
    onSetDefault,
    onDelete,
    onEdit,
    onCancelEdit,
    onSaveSamples,
}: {
    voice: BrandVoice
    isAnalyzing: boolean
    isEditing: boolean
    onAnalyze: () => void
    onSetDefault: () => void
    onDelete: () => void
    onEdit: () => void
    onCancelEdit: () => void
    onSaveSamples: (samples: string[]) => void
}) {
    const [editSamples, setEditSamples] = useState("")
    const styleProfile = voice.styleProfile as StyleProfile | null

    useEffect(() => {
        if (isEditing) {
            setEditSamples(voice.sampleTweets.join("\n---\n"))
        }
    }, [isEditing, voice.sampleTweets])

    const handleSave = () => {
        const samples = editSamples
            .split("\n---\n")
            .map(s => s.trim())
            .filter(s => s.length > 0)
        onSaveSamples(samples)
    }

    return (
        <Card className={cn(voice.isDefault && "ring-2 ring-primary/20")}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <CardTitle className="text-base">{voice.name}</CardTitle>
                        {voice.isDefault && (
                            <Badge variant="secondary" className="text-xs">
                                <Star className="h-3 w-3 mr-1 fill-current" />
                                默认
                            </Badge>
                        )}
                        {voice.styleProfile ? (
                            <Badge variant="outline" className="text-xs text-green-600 border-green-200">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                已分析
                            </Badge>
                        ) : (
                            <Badge variant="outline" className="text-xs text-amber-600 border-amber-200">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                待分析
                            </Badge>
                        )}
                    </div>
                    <div className="flex items-center gap-1">
                        {!voice.isDefault && (
                            <Button variant="ghost" size="sm" onClick={onSetDefault}>
                                <Star className="h-4 w-4" />
                            </Button>
                        )}
                        <Button variant="ghost" size="sm" onClick={onEdit}>
                            <Edit3 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700" onClick={onDelete}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
                {voice.description && (
                    <CardDescription>{voice.description}</CardDescription>
                )}
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Sample tweets section */}
                {isEditing ? (
                    <div className="space-y-2">
                        <Label>编辑示例推文</Label>
                        <Textarea
                            value={editSamples}
                            onChange={(e) => setEditSamples(e.target.value)}
                            className="min-h-[150px] font-mono text-sm"
                        />
                        <div className="flex gap-2">
                            <Button size="sm" onClick={handleSave}>保存</Button>
                            <Button size="sm" variant="outline" onClick={onCancelEdit}>取消</Button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">
                            示例推文 ({voice.sampleTweets.length})
                        </Label>
                        <div className="bg-muted/30 rounded-lg p-3 max-h-[100px] overflow-y-auto">
                            {voice.sampleTweets.slice(0, 2).map((tweet, i) => (
                                <p key={i} className="text-xs text-muted-foreground line-clamp-2 mb-1">
                                    {tweet}
                                </p>
                            ))}
                            {voice.sampleTweets.length > 2 && (
                                <p className="text-xs text-muted-foreground/60">
                                    +{voice.sampleTweets.length - 2} 更多...
                                </p>
                            )}
                        </div>
                    </div>
                )}

                {/* Style profile display */}
                {styleProfile && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">风格特征</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {styleProfile.tone?.primary && (
                                <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground">语调</p>
                                    <p className="text-xs font-medium">{styleProfile.tone.primary}</p>
                                </div>
                            )}
                            {styleProfile.vocabulary?.complexity && (
                                <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground">词汇复杂度</p>
                                    <p className="text-xs font-medium">{styleProfile.vocabulary.complexity}/5</p>
                                </div>
                            )}
                            {styleProfile.patterns?.sentenceLength && (
                                <div className="bg-purple-50 dark:bg-purple-950/30 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground">句子长度</p>
                                    <p className="text-xs font-medium">{styleProfile.patterns.sentenceLength}</p>
                                </div>
                            )}
                            {styleProfile.personality?.traits?.[0] && (
                                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-2">
                                    <p className="text-[10px] text-muted-foreground">性格特征</p>
                                    <p className="text-xs font-medium">{styleProfile.personality.traits[0]}</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* System prompt preview */}
                {voice.systemPrompt && (
                    <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">生成的提示词</Label>
                        <div className="bg-muted/30 rounded-lg p-3 max-h-[80px] overflow-y-auto">
                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                {voice.systemPrompt.slice(0, 200)}...
                            </p>
                        </div>
                    </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                    <Button
                        size="sm"
                        variant={voice.styleProfile ? "outline" : "default"}
                        onClick={onAnalyze}
                        disabled={isAnalyzing || voice.sampleTweets.length < 3}
                    >
                        {isAnalyzing ? (
                            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> 分析中...</>
                        ) : (
                            <><Sparkles className="h-4 w-4 mr-2" /> {voice.styleProfile ? "重新分析" : "分析风格"}</>
                        )}
                    </Button>
                    {voice.sampleTweets.length < 3 && (
                        <p className="text-xs text-amber-600 self-center">
                            需要至少3条示例推文才能分析
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
