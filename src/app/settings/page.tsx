"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { PageShell } from "@/components/layout/PageShell"
import { Loader2, Check, ExternalLink, Chrome, Globe } from "lucide-react"
import { useTranslations } from "@/stores/localeStore"
import { locales, localeNames, type Locale } from "@/i18n"
import { PoolsTagsSettings } from "@/components/settings/PoolsTagsSettings"

interface BrowserSession {
    isLoggedIn: boolean
    hasSession: boolean
    username?: string
    displayName?: string
}

export default function SettingsPage() {
    const { t, locale, setLocale } = useTranslations()
    const [browserSession, setBrowserSession] = useState<BrowserSession | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [isConnecting, setIsConnecting] = useState(false)
    const [statusMessage, setStatusMessage] = useState("")

    // 检查浏览器登录状态
    useEffect(() => {
        checkBrowserSession()
    }, [])

    const checkBrowserSession = async () => {
        setIsLoading(true)
        try {
            const res = await fetch("/api/publish/browser")
            const data = await res.json()
            setBrowserSession(data)
        } catch {
            setBrowserSession({ isLoggedIn: false, hasSession: false })
        } finally {
            setIsLoading(false)
        }
    }

    const handleBrowserLogin = async () => {
        setIsConnecting(true)
        setStatusMessage(t.settings.browser.waiting)

        try {
            const res = await fetch("/api/publish/browser", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "login" }),
            })
            const data = await res.json()

            if (data.success) {
                setStatusMessage(t.settings.browser.connected + "!")
                await checkBrowserSession()
            } else {
                setStatusMessage(data.message || "Login failed")
            }
        } catch {
            setStatusMessage("Connection failed")
        } finally {
            setIsConnecting(false)
        }
    }

    return (
        <PageShell title={t.settings.title} description={t.settings.description}>
            <div className="flex flex-col lg:flex-row gap-8">
                <Tabs defaultValue="general" orientation="vertical" className="flex-1 flex flex-col lg:flex-row gap-8">
                    <TabsList className="flex-col items-start justify-start h-auto w-full lg:w-48 bg-transparent p-0 gap-1">
                        <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full">{t.settings.tabs.preferences}</div>
                        <TabsTrigger
                            value="general"
                            className="w-full justify-start px-2 py-2 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none -ml-2 rounded-md text-sm text-muted-foreground transition-all hover:text-foreground"
                        >
                            {t.settings.tabs.general}
                        </TabsTrigger>
                        <TabsTrigger
                            value="pools"
                            className="w-full justify-start px-2 py-2 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none -ml-2 rounded-md text-sm text-muted-foreground transition-all hover:text-foreground"
                        >
                            {t.settings.tabs.poolsTags}
                        </TabsTrigger>
                        <div className="mt-3 px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground w-full">{t.settings.tabs.system}</div>
                        <TabsTrigger
                            value="integrations"
                            className="w-full justify-start px-2 py-2 data-[state=active]:bg-zinc-100 dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-foreground data-[state=active]:font-medium data-[state=active]:shadow-none -ml-2 rounded-md text-sm text-muted-foreground transition-all hover:text-foreground"
                        >
                            {t.settings.tabs.integrations}
                        </TabsTrigger>
                    </TabsList>

                    <div className="flex-1 max-w-xl space-y-6">
                        <TabsContent value="general" className="space-y-6 m-0 focus:outline-none">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium">Workspace</h3>
                                    <p className="text-xs text-muted-foreground">Configure your primary workspace settings.</p>
                                </div>
                                <div className="grid gap-4 p-4 rounded-lg border border-border/60 bg-card/30">
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Workspace Name</Label>
                                        <Input defaultValue="Product Thoughts" className="bg-transparent border-border/60 h-8 text-sm" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Default Pool</Label>
                                        <Select defaultValue="p1">
                                            <SelectTrigger className="bg-transparent border-border/60 h-8 text-sm"><SelectValue /></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="p1">Industry News</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <p className="text-[10px] text-muted-foreground">New ingests will default to this pool.</p>
                                    </div>
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Button size="sm" className="h-8 text-xs">Save Changes</Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="pools" className="space-y-6 m-0 focus:outline-none">
                            <PoolsTagsSettings />
                        </TabsContent>

                        <TabsContent value="integrations" className="space-y-6 m-0 focus:outline-none">
                            <div className="space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium">Browser Publishing</h3>
                                    <p className="text-xs text-muted-foreground">Use your browser session to publish directly to X.</p>
                                </div>

                                {/* Browser Session Card */}
                                <div className="rounded-lg border border-border/60 p-4 bg-card/30">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-black text-white rounded-lg flex items-center justify-center">
                                                <span className="font-bold text-lg">𝕏</span>
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm flex items-center gap-2">
                                                    X (Browser Mode)
                                                    {browserSession?.isLoggedIn && (
                                                        <Badge variant="outline" className="text-[9px] text-green-600 border-green-200 bg-green-50">
                                                            <Check className="h-2.5 w-2.5 mr-0.5" /> Connected
                                                        </Badge>
                                                    )}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    {isLoading ? (
                                                        "Checking session..."
                                                    ) : browserSession?.isLoggedIn ? (
                                                        <span>Logged in as @{browserSession.username || "user"}</span>
                                                    ) : (
                                                        "Not connected"
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <Button
                                            variant={browserSession?.isLoggedIn ? "outline" : "default"}
                                            size="sm"
                                            className="h-8 text-xs"
                                            onClick={handleBrowserLogin}
                                            disabled={isConnecting || isLoading}
                                        >
                                            {isConnecting ? (
                                                <><Loader2 className="h-3 w-3 mr-1.5 animate-spin" /> Waiting...</>
                                            ) : browserSession?.isLoggedIn ? (
                                                <><Chrome className="h-3 w-3 mr-1.5" strokeWidth={1.5} /> Re-login</>
                                            ) : (
                                                <><Chrome className="h-3 w-3 mr-1.5" strokeWidth={1.5} /> Open Browser</>
                                            )}
                                        </Button>
                                    </div>

                                    {statusMessage && (
                                        <div className="mt-3 pt-3 border-t text-xs text-muted-foreground">
                                            {statusMessage}
                                        </div>
                                    )}

                                    <div className="mt-4 pt-4 border-t space-y-2">
                                        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">How it works</div>
                                        <ul className="text-xs text-muted-foreground space-y-1">
                                            <li className="flex items-start gap-2">
                                                <span className="text-muted-foreground/50">1.</span>
                                                Click “Open Browser” to launch Chromium
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-muted-foreground/50">2.</span>
                                                Log in to your X account in the browser window
                                            </li>
                                            <li className="flex items-start gap-2">
                                                <span className="text-muted-foreground/50">3.</span>
                                                Your session is saved locally for future use
                                            </li>
                                        </ul>
                                    </div>
                                </div>

                                {/* Legacy OAuth Section (hidden for now) */}
                                <div className="rounded-lg border border-border/30 p-4 opacity-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-700 text-zinc-500 rounded-lg flex items-center justify-center">
                                                <ExternalLink className="h-5 w-5" strokeWidth={1.5} />
                                            </div>
                                            <div>
                                                <div className="font-medium text-sm">X API (OAuth)</div>
                                                <div className="text-xs text-muted-foreground">Requires API credentials</div>
                                            </div>
                                        </div>
                                        <Button variant="outline" size="sm" className="h-8 text-xs" disabled>
                                            Coming Soon
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </div>
        </PageShell>
    )
}
