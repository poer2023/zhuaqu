"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { PageShell } from "@/components/layout/PageShell"
import { ContentItemDrawer } from "@/components/pools/ContentItemDrawer"
import { Search, Filter, Plus, PenTool, Tag, Trash2, Loader2 } from "lucide-react"
import { format } from "date-fns"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { usePoolStore } from "@/stores/poolStore"
import { useTranslations } from "@/stores/localeStore"

export default function PoolsPage() {
    const { t } = useTranslations()
    const [searchQuery, setSearchQuery] = useState("")
    const [selectedPoolFilter, setSelectedPoolFilter] = useState("all")

    // Zustand stores
    const { currentWorkspace, currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
    const {
        items,
        pageInfo,
        selectedItemIds,
        isLoading,
        fetchItems,
        setFilters,
        selectItem,
        deselectItem,
        selectAll,
        clearSelection,
        deleteItems
    } = usePoolStore()

    // Drawer state - use items type
    const [drawerItem, setDrawerItem] = useState<(typeof items)[number] | null>(null)

    // 加载工作区
    useEffect(() => {
        fetchWorkspaces()
    }, [fetchWorkspaces])

    // 加载素材池内容
    useEffect(() => {
        if (currentWorkspaceId) {
            const poolId = selectedPoolFilter !== "all" ? selectedPoolFilter : undefined
            fetchItems(currentWorkspaceId, poolId)
        }
    }, [currentWorkspaceId, selectedPoolFilter, fetchItems])

    // 搜索防抖
    useEffect(() => {
        const timer = setTimeout(() => {
            setFilters({ q: searchQuery || undefined })
            if (currentWorkspaceId) {
                const poolId = selectedPoolFilter !== "all" ? selectedPoolFilter : undefined
                fetchItems(currentWorkspaceId, poolId)
            }
        }, 300)
        return () => clearTimeout(timer)
    }, [searchQuery, setFilters, fetchItems, currentWorkspaceId, selectedPoolFilter])

    const handleSelectItem = (itemId: string, checked: boolean) => {
        if (checked) {
            selectItem(itemId)
        } else {
            deselectItem(itemId)
        }
    }

    const handleDelete = async () => {
        if (selectedItemIds.length > 0) {
            await deleteItems(selectedItemIds)
            if (currentWorkspaceId) {
                fetchItems(currentWorkspaceId)
            }
        }
    }

    return (
        <PageShell
            title="Content Pools"
            headerAction={
                <Button size="sm" className="h-8 px-3 text-xs font-medium">
                    <Plus className="h-3.5 w-3.5 mr-1.5" strokeWidth={1.5} />
                    Add New
                </Button>
            }
        >
            <div className="space-y-4">
                {/* Filter Control Bar */}
                <div className="flex items-center gap-3 bg-muted/20 p-1 rounded-lg border max-w-fit">
                    <Select value={selectedPoolFilter} onValueChange={setSelectedPoolFilter}>
                        <SelectTrigger className="w-[140px] border-none shadow-none h-7 bg-transparent focus:ring-0 text-xs font-medium">
                            <SelectValue placeholder="All Pools" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Pools</SelectItem>
                            {currentWorkspace?.pools?.map(p => (
                                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-px bg-border/60"></div>
                    <div className="relative">
                        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
                        <Input
                            className="w-[160px] h-7 pl-7 border-none shadow-none bg-transparent focus-visible:ring-0 placeholder:text-muted-foreground/50 text-xs"
                            placeholder="Filter..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7"><Filter className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} /></Button>
                </div>

                {/* Table */}
                <div className="rounded-lg border border-border/60 bg-background/50 overflow-hidden">
                    {isLoading ? (
                        <div className="h-64 flex items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="h-64 flex flex-col items-center justify-center text-muted-foreground">
                            <p className="text-sm">No items found</p>
                            <p className="text-xs mt-1">Import content from the Ingest page</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-muted/10">
                                <TableRow className="hover:bg-transparent border-b-border/60">
                                    <TableHead className="w-[40px] pl-3">
                                        <Checkbox
                                            checked={selectedItemIds.length === items.length && items.length > 0}
                                            onCheckedChange={(c) => c ? selectAll() : clearSelection()}
                                        />
                                    </TableHead>
                                    <TableHead className="w-[160px] font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Author</TableHead>
                                    <TableHead className="font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Content</TableHead>
                                    <TableHead className="w-[90px] font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Status</TableHead>
                                    <TableHead className="w-[80px] text-right pr-4 font-semibold text-[10px] uppercase tracking-wider text-muted-foreground">Date</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item) => (
                                    <TableRow
                                        key={item.id}
                                        className="h-14 border-b-border/40 hover:bg-muted/20 group transition-colors cursor-pointer"
                                        onClick={() => setDrawerItem(item)}
                                    >
                                        <TableCell className="pl-3">
                                            <Checkbox
                                                checked={selectedItemIds.includes(item.id)}
                                                onCheckedChange={(c) => handleSelectItem(item.id, !!c)}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <div className="h-7 w-7 rounded-full bg-zinc-100 flex items-center justify-center text-[10px] font-bold dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                                                    {item.authorHandle[0]?.toUpperCase() || "?"}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-medium leading-none">{item.authorHandle}</span>
                                                    <span className="text-[10px] text-muted-foreground">@{item.authorHandle}</span>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <p className="text-sm text-foreground/80 line-clamp-1 max-w-[360px]">
                                                {item.textOriginal}
                                            </p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={`text-[10px] ${item.publishStatus === 'PUBLISHED' ? "text-green-600 border-green-200 bg-green-50/50 dark:bg-green-900/10 dark:border-green-800/50" :
                                                item.rewriteStatus === 'APPROVED' ? "text-blue-600 border-blue-200 bg-blue-50/50" :
                                                    "text-zinc-500 bg-zinc-100/50 border-zinc-200 dark:bg-zinc-800/30 dark:border-zinc-700"
                                                }`}>
                                                {item.publishStatus === 'PUBLISHED' ? 'published' :
                                                    item.rewriteStatus === 'APPROVED' ? 'approved' :
                                                        item.captureStatus.toLowerCase()}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right pr-4">
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                {format(new Date(item.createdAt), "MM/dd")}
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </div>

                {/* Pagination Info */}
                {pageInfo && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                        <span>{pageInfo.total} items total</span>
                        <span>Page {pageInfo.page} of {pageInfo.totalPages}</span>
                    </div>
                )}
            </div>

            {/* Floating Actions */}
            {selectedItemIds.length > 0 && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="glass pl-4 pr-1.5 py-1.5 rounded-full shadow-2xl flex items-center gap-3 border border-white/10 dark:border-white/5">
                        <span className="text-xs font-medium whitespace-nowrap">{selectedItemIds.length} selected</span>
                        <div className="h-3 w-px bg-border/50"></div>
                        <div className="flex items-center gap-0.5">
                            <Button size="sm" variant="ghost" className="h-7 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full text-xs font-medium px-2.5">
                                <PenTool className="h-3 w-3 mr-1.5" strokeWidth={1.5} /> Rewrite
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full w-7 p-0">
                                <Tag className="h-3 w-3" strokeWidth={1.5} />
                            </Button>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-600 rounded-full w-7 p-0 text-muted-foreground transition-colors"
                                onClick={handleDelete}
                            >
                                <Trash2 className="h-3 w-3" strokeWidth={1.5} />
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Detail Drawer */}
            <ContentItemDrawer
                item={drawerItem as Parameters<typeof ContentItemDrawer>[0]['item']}
                open={!!drawerItem}
                onClose={() => setDrawerItem(null)}
            />
        </PageShell>
    )
}
