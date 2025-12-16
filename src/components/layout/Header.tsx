"use client"

import { Search, Bell } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { LanguageSwitcher } from "./LanguageSwitcher"

export function Header() {
    const { workspaces, currentWorkspaceId, setCurrentWorkspace } = useWorkspaceStore()

    // Header acts as strict global top-nav now, PageShell handles titles.
    return (
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/50 px-6 backdrop-blur-xl transition-all">
            {/* Left side empty for now or breadcrumbs */}
            <div className="flex-1" />

            <div className="flex items-center gap-2 md:gap-4">
                {/* Workspace Switcher */}
                <div className="w-[180px]">
                    <Select
                        value={currentWorkspaceId || ""}
                        onValueChange={setCurrentWorkspace}
                    >
                        <SelectTrigger className="h-8 border-none bg-transparent shadow-none hover:bg-accent/50 focus:ring-0 text-xs font-medium">
                            <SelectValue placeholder="Select Workspace" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            {workspaces.map((ws) => (
                                <SelectItem key={ws.id} value={ws.id} className="text-xs">
                                    {ws.name}
                                </SelectItem>
                            ))}
                            <div className="px-2 py-1">
                                <Button variant="ghost" size="sm" className="w-full justify-start text-[10px] h-6 text-muted-foreground">
                                    + New Workspace
                                </Button>
                            </div>
                        </SelectContent>
                    </Select>
                </div>

                {/* Global Search */}
                <div className="relative hidden sm:block">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/50" />
                    <Input
                        type="search"
                        placeholder="Search or jump to..."
                        className="w-[240px] bg-muted/20 pl-8 h-8 rounded-lg border-0 focus-visible:ring-1 focus-visible:ring-zinc-200 placeholder:text-muted-foreground/40 text-sm transition-all hover:bg-muted/40"
                    />
                    <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100 sm:flex">
                        <span className="text-xs">⌘</span>K
                    </kbd>
                </div>

                <div className="flex items-center gap-1 border-l pl-2 ml-2">
                    <LanguageSwitcher />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground">
                        <Bell className="h-4 w-4" strokeWidth={1.5} />
                    </Button>
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-zinc-100 to-zinc-200 border border-zinc-200 ml-1"></div>
                </div>
            </div>
        </header>
    )
}

