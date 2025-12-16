"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { LanguageSwitcher } from "./LanguageSwitcher"
import {
    LayoutGrid,
    Send,
    Zap,
    ListChecks,
    Settings,
    GalleryVerticalEnd,
    ChevronLeft,
    ChevronRight,
    Search,
    Bell,
    Loader2,
    type LucideIcon
} from "lucide-react"

interface NavItem {
    href: string
    labelKey: string
    icon: LucideIcon
}

const navItems: NavItem[] = [
    { href: "/content", labelKey: "content", icon: LayoutGrid },
    { href: "/publish", labelKey: "publish", icon: Send },
    { href: "/automation", labelKey: "automation", icon: Zap },
    { href: "/jobs", labelKey: "jobs", icon: ListChecks },
    { href: "/settings", labelKey: "settings", icon: Settings },
]

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed"

export function Sidebar() {
    const pathname = usePathname()
    const { workspaces, currentWorkspace, currentWorkspaceId, setCurrentWorkspace, createWorkspace } = useWorkspaceStore()
    const { t } = useTranslations()
    const [isCollapsed, setIsCollapsed] = useState(false)
    const [showCreateDialog, setShowCreateDialog] = useState(false)
    const [newWorkspaceName, setNewWorkspaceName] = useState("")
    const [isCreating, setIsCreating] = useState(false)

    // Load collapsed state from localStorage
    useEffect(() => {
        const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
        if (stored === "true") {
            setIsCollapsed(true)
        }
    }, [])

    const toggleCollapsed = () => {
        const newState = !isCollapsed
        setIsCollapsed(newState)
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newState))
    }

    const handleCreateWorkspace = async () => {
        if (!newWorkspaceName.trim()) return
        setIsCreating(true)
        try {
            const ws = await createWorkspace(newWorkspaceName.trim())
            if (ws) {
                setCurrentWorkspace(ws.id)
                setShowCreateDialog(false)
                setNewWorkspaceName("")
            }
        } finally {
            setIsCreating(false)
        }
    }

    const getLabel = (key: string) => {
        const nav = t.nav as Record<string, string>
        return nav[key] || key
    }

    // Set CSS variable for dynamic sidebar width
    useEffect(() => {
        document.documentElement.style.setProperty('--sidebar-width', isCollapsed ? '64px' : '240px')
    }, [isCollapsed])

    return (
        <TooltipProvider delayDuration={0}>
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col border-r bg-background/80 backdrop-blur-xl transition-all duration-300",
                    isCollapsed ? "w-16" : "w-60"
                )}
            >
                {/* Logo & Toggle */}
                <div className={cn(
                    "flex h-14 items-center shrink-0 border-b",
                    isCollapsed ? "justify-center px-2" : "justify-between px-4"
                )}>
                    <Link href="/content" className="flex items-center gap-2.5 font-medium transition-opacity hover:opacity-80">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
                            <GalleryVerticalEnd className="size-4" strokeWidth={2} />
                        </div>
                        {!isCollapsed && <span className="text-sm tracking-tight font-semibold">ZhaQu</span>}
                    </Link>
                    {!isCollapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            onClick={toggleCollapsed}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                    )}
                </div>

                {/* Workspace Selector */}
                <div className={cn("px-3 py-3 border-b", isCollapsed && "px-2")}>
                    {isCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-full h-9">
                                    <div className="h-6 w-6 rounded-md bg-accent flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                                        {currentWorkspace?.name?.charAt(0) || "W"}
                                    </div>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">
                                {currentWorkspace?.name || "Select Workspace"}
                            </TooltipContent>
                        </Tooltip>
                    ) : (
                        <Select value={currentWorkspaceId || ""} onValueChange={setCurrentWorkspace}>
                            <SelectTrigger className="h-9 text-xs font-medium bg-accent/50 border-0">
                                <SelectValue placeholder="Select Workspace" />
                            </SelectTrigger>
                            <SelectContent>
                                {workspaces.map((ws) => (
                                    <SelectItem key={ws.id} value={ws.id} className="text-xs">
                                        {ws.name}
                                    </SelectItem>
                                ))}
                                <div className="px-2 py-1 border-t mt-1">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="w-full justify-start text-[10px] h-7 text-muted-foreground"
                                        onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setShowCreateDialog(true)
                                        }}
                                    >
                                        + New Workspace
                                    </Button>
                                </div>
                            </SelectContent>
                        </Select>
                    )}
                </div>

                {/* Search */}
                <div className={cn("px-3 py-2", isCollapsed && "px-2")}>
                    {isCollapsed ? (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" className="w-full h-9 text-muted-foreground">
                                    <Search className="h-4 w-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="right">Search ⌘K</TooltipContent>
                        </Tooltip>
                    ) : (
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                            <Input
                                type="search"
                                placeholder="Search..."
                                className="w-full bg-accent/30 pl-8 h-9 rounded-lg border-0 focus-visible:ring-1 placeholder:text-muted-foreground/40 text-sm"
                            />
                            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-0.5 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                                <span className="text-xs">⌘</span>K
                            </kbd>
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 flex flex-col gap-1 px-3 py-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href || pathname.startsWith(item.href + "/")
                        const label = getLabel(item.labelKey)

                        if (isCollapsed) {
                            return (
                                <Tooltip key={item.href}>
                                    <TooltipTrigger asChild>
                                        <Link
                                            href={item.href}
                                            className={cn(
                                                "flex items-center justify-center rounded-lg h-10 w-10 mx-auto transition-all duration-200",
                                                isActive
                                                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                                                    : "text-muted-foreground hover:bg-zinc-100/50 hover:text-zinc-900 dark:hover:bg-zinc-800/50"
                                            )}
                                        >
                                            <item.icon className="size-4" strokeWidth={1.5} />
                                        </Link>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">{label}</TooltipContent>
                                </Tooltip>
                            )
                        }

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-200 group",
                                    isActive
                                        ? "bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-zinc-100"
                                        : "text-muted-foreground hover:bg-zinc-100/50 hover:text-zinc-900 dark:hover:bg-zinc-800/50"
                                )}
                            >
                                <item.icon
                                    className={cn("size-4 transition-colors", isActive ? "text-zinc-900 dark:text-zinc-100" : "text-muted-foreground group-hover:text-zinc-700")}
                                    strokeWidth={1.5}
                                />
                                {label}
                            </Link>
                        )
                    })}
                </nav>

                {/* Bottom Actions */}
                <div className={cn("border-t p-3 space-y-2", isCollapsed && "px-2")}>
                    {/* Language & Notifications */}
                    <div className={cn("flex items-center gap-1", isCollapsed ? "flex-col" : "justify-between")}>
                        {isCollapsed ? (
                            <>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                                            <Bell className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent side="right">Notifications</TooltipContent>
                                </Tooltip>
                                <LanguageSwitcher collapsed />
                            </>
                        ) : (
                            <>
                                <LanguageSwitcher />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Bell className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                    </div>

                    {/* User */}
                    <div className={cn("flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50 cursor-pointer transition-colors", isCollapsed && "justify-center p-1")}>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-br from-zinc-200 to-zinc-300 border flex-shrink-0" />
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium truncate">User</div>
                                <div className="text-[10px] text-muted-foreground truncate">user@example.com</div>
                            </div>
                        )}
                    </div>

                    {/* Expand button when collapsed */}
                    {isCollapsed && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-full h-9 text-muted-foreground hover:text-foreground"
                            onClick={toggleCollapsed}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    )}
                </div>
            </aside>

            {/* Create Workspace Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent className="sm:max-w-[400px]">
                    <DialogHeader>
                        <DialogTitle>创建新工作区</DialogTitle>
                        <DialogDescription>
                            输入工作区名称，每个工作区可以有独立的素材池和标签。
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="workspace-name">工作区名称</Label>
                            <Input
                                id="workspace-name"
                                value={newWorkspaceName}
                                onChange={(e) => setNewWorkspaceName(e.target.value)}
                                placeholder="例如：产品运营、个人品牌"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !isCreating) {
                                        handleCreateWorkspace()
                                    }
                                }}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowCreateDialog(false)} disabled={isCreating}>
                            取消
                        </Button>
                        <Button onClick={handleCreateWorkspace} disabled={isCreating || !newWorkspaceName.trim()}>
                            {isCreating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            创建
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </TooltipProvider>
    )
}
