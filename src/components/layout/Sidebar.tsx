"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"
import { useTranslations } from "@/stores/localeStore"
import {
    LayoutGrid,
    Send,
    Zap,
    ListChecks,
    Settings,
    GalleryVerticalEnd,
    type LucideIcon
} from "lucide-react"

interface NavItem {
    href: string
    labelKey: string
    icon: LucideIcon
}

// 4 项一级导航
const navItems: NavItem[] = [
    { href: "/content", labelKey: "content", icon: LayoutGrid },
    { href: "/publish", labelKey: "publish", icon: Send },
    { href: "/automation", labelKey: "automation", icon: Zap },
    { href: "/jobs", labelKey: "jobs", icon: ListChecks },
    { href: "/settings", labelKey: "settings", icon: Settings },
]

export function Sidebar() {
    const pathname = usePathname()
    const { currentWorkspace } = useWorkspaceStore()
    const { t } = useTranslations()

    const getLabel = (key: string) => {
        const nav = t.nav as Record<string, string>
        return nav[key] || key
    }

    return (
        <aside className="fixed inset-y-0 left-0 z-50 w-64 border-r bg-background/80 backdrop-blur-xl">
            <div className="flex h-14 items-center px-6">
                <Link href="/content" className="flex items-center gap-2.5 font-medium transition-opacity hover:opacity-80">
                    <div className="flex h-6 w-6 items-center justify-center rounded-md bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900">
                        <GalleryVerticalEnd className="size-3.5" strokeWidth={2} />
                    </div>
                    <span className="text-sm tracking-tight font-semibold">ZhaQu</span>
                </Link>
            </div>

            <div className="flex flex-col gap-1 p-3">
                {currentWorkspace && (
                    <div className="mb-2 px-3 py-2 text-xs font-medium text-muted-foreground/60 uppercase tracking-wider">
                        {currentWorkspace.name}
                    </div>
                )}

                {navItems.map((item) => {
                    const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200 group",
                                isActive
                                    ? "bg-zinc-100 text-zinc-900 font-medium dark:bg-zinc-800 dark:text-zinc-100"
                                    : "text-muted-foreground hover:bg-zinc-100/50 hover:text-zinc-900 dark:hover:bg-zinc-800/50 dark:hover:text-zinc-100"
                            )}
                        >
                            <item.icon
                                className={cn("size-4 transition-colors", isActive ? "text-zinc-900 dark:text-zinc-100" : "text-muted-foreground group-hover:text-zinc-700")}
                                strokeWidth={1.5}
                            />
                            {getLabel(item.labelKey)}
                        </Link>
                    )
                })}
            </div>
        </aside>
    )
}
