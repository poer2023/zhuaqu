"use client"

import { useEffect, useState } from "react"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import {
  Inbox,
  FolderOpen,
  PenTool,
  Send,
  ArrowRight,
  Plus,
  Sparkles,
  LayoutGrid,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTranslations } from "@/stores/localeStore"
import { useWorkspaceStore } from "@/stores/workspaceStore"

interface DashboardStats {
  queued: number
  inPool: number
  pendingRewrite: number
  published: number
  thisWeekPublished: number
}

interface Activity {
  id: string
  message: string
  time: string
  status: "success" | "error"
}

export default function HomePage() {
  const { t } = useTranslations()
  const { currentWorkspaceId, fetchWorkspaces } = useWorkspaceStore()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchWorkspaces()
  }, [fetchWorkspaces])

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        setIsLoading(true)
        const url = currentWorkspaceId
          ? `/api/dashboard/stats?workspaceId=${currentWorkspaceId}`
          : '/api/dashboard/stats'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setStats(data.stats)
          setActivities(data.recentActivity)
        }
      } catch (error) {
        console.error('Failed to fetch dashboard stats:', error)
      } finally {
        setIsLoading(false)
      }
    }

    fetchDashboardData()
  }, [currentWorkspaceId])

  const statsConfig = [
    { id: "queued", title: t.publish.stats.pending, value: stats?.queued ?? 0, label: t.publish.stats.pending, icon: Inbox },
    { id: "inPool", title: t.dashboard.stats.inPool, value: stats?.inPool ?? 0, label: t.common.viewAll, icon: FolderOpen },
    { id: "toRewrite", title: t.dashboard.stats.pendingRewrite, value: stats?.pendingRewrite ?? 0, label: t.rewrite.actions.rework, icon: PenTool },
    { id: "published", title: t.dashboard.stats.published, value: stats?.published ?? 0, label: `${stats?.thisWeekPublished ?? 0} ${t.dashboard.stats.thisWeek}`, icon: Send },
  ]

  const quickActions = [
    { href: "/ingest", icon: Inbox, title: t.dashboard.quickActions.ingestNew, desc: t.dashboard.quickActions.ingestDesc },
    { href: "/rewrite", icon: Sparkles, title: t.dashboard.quickActions.startRewrite, desc: t.dashboard.quickActions.rewriteDesc },
    { href: "/publish", icon: Send, title: t.dashboard.quickActions.publishQueue, desc: t.dashboard.quickActions.publishDesc },
    { href: "/pools", icon: LayoutGrid, title: t.nav.pools, desc: t.pools.importHint },
  ]

  return (
    <PageShell
      title={t.nav.overview}
      description={t.dashboard.welcomeBack}
      headerAction={
        <Link href="/ingest">
          <Button className="h-9 px-4 rounded-lg bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-all font-medium">
            <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
            {t.dashboard.quickActions.ingestNew}
          </Button>
        </Link>
      }
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-border/40 rounded-xl overflow-hidden border shadow-sm">
          {statsConfig.map((stat) => (
            <div key={stat.id} className="bg-background/50 p-5 hover:bg-background transition-colors group">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors uppercase tracking-wide">{stat.title}</span>
                <stat.icon className="h-4 w-4 text-muted-foreground/40 group-hover:text-foreground transition-colors" strokeWidth={1.5} />
              </div>
              <div className="flex items-baseline gap-2">
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <span className="text-2xl font-semibold tracking-tight text-foreground">
                      {typeof stat.value === 'number' ? stat.value.toLocaleString() : stat.value}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-medium">{stat.label}</span>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.dashboard.quickActions.title}</h2>
            <div className="grid sm:grid-cols-2 gap-3">
              {quickActions.map((item) => (
                <Link key={item.href} href={item.href} className="group block">
                  <div className="rounded-lg border border-border/50 bg-background/50 p-4 transition-all duration-200 hover:border-border hover:bg-background hover:shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0 rounded-md bg-muted/80 p-2 group-hover:bg-muted transition-colors">
                        <item.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{item.title}</p>
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50 group-hover:text-foreground group-hover:translate-x-0.5 transition-all" strokeWidth={2} />
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{item.desc}</p>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{t.dashboard.recentActivity.title}</h2>
            <div className="rounded-lg border border-border/50 bg-background/50 overflow-hidden">
              {isLoading ? (
                <div className="p-8 flex items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : activities.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm">
                  {t.common.noData}
                </div>
              ) : (
                <div className="divide-y divide-border/50">
                  {activities.map((activity) => (
                    <div key={activity.id} className="px-4 py-3 hover:bg-background transition-colors">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "mt-1.5 h-1.5 w-1.5 rounded-full shrink-0",
                          activity.status === "error" ? "bg-red-500" : "bg-emerald-500"
                        )} />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-muted-foreground uppercase tracking-wide">{activity.time}</p>
                          <p className="text-sm text-foreground/90 mt-0.5 line-clamp-2">{activity.message}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link
                href="/audit"
                className="flex items-center justify-center gap-1 px-4 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground border-t border-border/50 transition-colors"
              >
                {t.dashboard.recentActivity.viewAll}
                <ArrowRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  )
}
