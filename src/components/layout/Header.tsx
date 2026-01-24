"use client"

import { Search, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { LanguageSwitcher } from "./LanguageSwitcher"

export function Header() {
    const { workspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore()

    return (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border/50 bg-background/80 px-6 backdrop-blur-xl transition-all">
            {/* Left side - Logo/Brand */}
            <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                    <span className="text-sm font-bold text-primary">抓</span>
                </div>
                <span className="hidden font-semibold text-foreground sm:inline-block">zhuaqu</span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2 md:gap-3">
                {/* Workspace Switcher */}
                <div className="w-[180px]">
                    <Select
                        value={currentWorkspaceId || ""}
                        onValueChange={setCurrentWorkspace}
                    >
                        <SelectTrigger className="h-8 border-border/50 bg-secondary/50 shadow-none hover:bg-secondary focus:ring-1 focus:ring-primary/20 text-xs font-medium transition-colors">
                            <SelectValue placeholder="Select Workspace" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {workspaces.map((ws) => (
                                <SelectItem key={ws.id} value={ws.id} className="text-xs">
                                    {ws.name}
                                </SelectItem>
                            ))}
                            <div className="px-2 py-1 border-t border-border/50 mt-1">
                                <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-6 text-primary hover:text-primary hover:bg-primary/10">
                                    + New Workspace
                                </Button>
                            </div>
                        </SelectContent>
                    </Select>
                </div>

                {/* Global Search */}
                <div className="relative hidden sm:block">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
                    <Input
                        type="search"
                        placeholder="Search or jump to..."
                        className="w-[240px] bg-secondary/50 pl-8 h-8 rounded-lg border-border/50 focus-visible:ring-1 focus-visible:ring-primary/30 focus-visible:border-primary/50 placeholder:text-muted-foreground/50 text-sm transition-all hover:bg-secondary"
                    />
                    <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border border-border/50 bg-muted/50 px-1.5 font-mono text-[10px] font-medium text-muted-foreground sm:flex">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </div>

                <div className="flex items-center gap-1 border-l border-border/50 pl-3 ml-1">
                    <LanguageSwitcher />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors">
                        <Bell className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/40 border border-primary/20 ml-1 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary">U</span>
                    </div>
                </div>
            </div>
        </header>
    )
}

