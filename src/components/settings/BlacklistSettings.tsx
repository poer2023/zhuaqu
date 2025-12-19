"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, Plus, X, AlertCircle } from "lucide-react"
import { useWorkspaceStore } from "@/stores/workspaceStore"

export function BlacklistSettings() {
    const { currentWorkspace, currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()

    // State for inputs
    const [authorInput, setAuthorInput] = useState("")
    const [keywordInput, setKeywordInput] = useState("")

    // Local state for the lists (sync with workspace settings)
    const [authors, setAuthors] = useState<string[]>([])
    const [keywords, setKeywords] = useState<string[]>([])

    const [isSaving, setIsSaving] = useState(false)
    const [hasChanges, setHasChanges] = useState(false)

    // Load initial settings
    useEffect(() => {
        if (currentWorkspace?.settings) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const settings = currentWorkspace.settings as any
            const blacklist = settings.blacklist || {}
            setAuthors(Array.isArray(blacklist.authors) ? blacklist.authors : [])
            setKeywords(Array.isArray(blacklist.keywords) ? blacklist.keywords : [])
            setHasChanges(false)
        }
    }, [currentWorkspace])

    const handleAddAuthor = () => {
        if (!authorInput.trim()) return
        const val = authorInput.trim().startsWith("@") ? authorInput.trim() : "@" + authorInput.trim()
        if (!authors.includes(val)) {
            setAuthors([...authors, val])
            setHasChanges(true)
        }
        setAuthorInput("")
    }

    const handleRemoveAuthor = (val: string) => {
        setAuthors(authors.filter(a => a !== val))
        setHasChanges(true)
    }

    const handleAddKeyword = () => {
        const val = keywordInput.trim()
        if (!val) return
        if (!keywords.includes(val)) {
            setKeywords([...keywords, val])
            setHasChanges(true)
        }
        setKeywordInput("")
    }

    const handleRemoveKeyword = (val: string) => {
        setKeywords(keywords.filter(k => k !== val))
        setHasChanges(true)
    }

    const handleSave = async () => {
        if (!currentWorkspaceId || !currentWorkspace) return
        setIsSaving(true)
        try {
            // Merge with existing settings
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingSettings = (currentWorkspace.settings as any) || {}

            const newSettings = {
                ...existingSettings,
                blacklist: {
                    authors,
                    keywords
                }
            }

            const res = await fetch(`/api/workspaces/${currentWorkspaceId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    settings: newSettings
                }),
            })

            if (res.ok) {
                await fetchWorkspaces()
                setHasChanges(false)
            }
        } catch (error) {
            console.error("Failed to save blacklist:", error)
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="space-y-6">
            <div className="border-b pb-4">
                <h3 className="text-sm font-medium">Blacklist & Rules</h3>
                <p className="text-xs text-muted-foreground mt-1">
                    Manage authors and keywords that should be automatically ignored or flagged.
                </p>
            </div>

            <div className="space-y-6">
                {/* Authors Blacklist */}
                <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked Authors</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="@username"
                            value={authorInput}
                            onChange={(e) => setAuthorInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddAuthor()}
                            className="h-8 text-sm"
                        />
                        <Button size="sm" variant="secondary" onClick={handleAddAuthor} className="h-8">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-md bg-muted/20 border border-muted/30">
                        {authors.length === 0 && (
                            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 opacity-70">
                                <AlertCircle className="h-3 w-3" /> No blocked authors
                            </span>
                        )}
                        {authors.map(author => (
                            <Badge key={author} variant="secondary" className="pl-2 pr-1 h-6 flex items-center gap-1 bg-background border shadow-sm">
                                {author}
                                <button
                                    onClick={() => handleRemoveAuthor(author)}
                                    className="h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center ml-1"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Content from these authors will be skipped during ingest.
                    </p>
                </div>

                {/* Keywords Blacklist */}
                <div className="space-y-3">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Blocked Keywords</Label>
                    <div className="flex gap-2">
                        <Input
                            placeholder="keyword or phrase"
                            value={keywordInput}
                            onChange={(e) => setKeywordInput(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                            className="h-8 text-sm"
                        />
                        <Button size="sm" variant="secondary" onClick={handleAddKeyword} className="h-8">
                            <Plus className="h-3.5 w-3.5" />
                        </Button>
                    </div>
                    <div className="flex flex-wrap gap-2 min-h-[40px] p-3 rounded-md bg-muted/20 border border-muted/30">
                        {keywords.length === 0 && (
                            <span className="text-xs text-muted-foreground italic flex items-center gap-1.5 opacity-70">
                                <AlertCircle className="h-3 w-3" /> No blocked keywords
                            </span>
                        )}
                        {keywords.map(keyword => (
                            <Badge key={keyword} variant="secondary" className="pl-2 pr-1 h-6 flex items-center gap-1 bg-background border shadow-sm">
                                {keyword}
                                <button
                                    onClick={() => handleRemoveKeyword(keyword)}
                                    className="h-4 w-4 rounded-full hover:bg-muted-foreground/20 flex items-center justify-center ml-1"
                                >
                                    <X className="h-2.5 w-2.5" />
                                </button>
                            </Badge>
                        ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                        Content containing these keywords will be flagged or skipped.
                    </p>
                </div>
            </div>

            <div className="flex justify-end pt-4 border-t">
                <Button
                    onClick={handleSave}
                    disabled={!hasChanges || isSaving}
                    size="sm"
                >
                    {isSaving && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save Rules
                </Button>
            </div>
        </div>
    )
}
