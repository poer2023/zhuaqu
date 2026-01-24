"use client"

import { useEffect, useState, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { PageShell } from "@/components/layout/PageShell"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
    Plus,
    Loader2,
    Trash2,
    Star,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    Clock,
    ExternalLink,
    Twitter,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useWorkspaceStore } from "@/stores/workspaceStore"

interface XAccount {
    id: string
    xUserId: string
    xUsername: string
    xDisplayName: string | null
    xAvatar: string | null
    isActive: boolean
    isDefault: boolean
    tokenExpiry: string | null
    tokenStatus: "valid" | "expiring" | "expired" | "unknown"
    lastUsedAt: string | null
    lastError: string | null
    createdAt: string
}

export default function XAccountsSettingsPage() {
    const { currentWorkspaceId } = useWorkspaceStore()
    const searchParams = useSearchParams()
    const [accounts, setAccounts] = useState<XAccount[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [isConnecting, setIsConnecting] = useState(false)
    const [refreshingId, setRefreshingId] = useState<string | null>(null)
    const [deleteId, setDeleteId] = useState<string | null>(null)
    const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null)

    // Check for callback messages
    useEffect(() => {
        const success = searchParams.get("success")
        const error = searchParams.get("error")

        if (success) {
            setMessage({ type: "success", text: "X 账号绑定成功！" })
            // Clean URL
            window.history.replaceState({}, "", "/settings/x-accounts")
        } else if (error) {
            const errorMessages: Record<string, string> = {
                access_denied: "您取消了授权",
                session_expired: "会话已过期，请重试",
                invalid_state: "无效的请求，请重试",
                config_error: "服务器配置错误",
                callback_failed: "授权回调失败",
                missing_params: "缺少必要参数",
            }
            setMessage({ type: "error", text: errorMessages[error] || "绑定失败，请重试" })
            window.history.replaceState({}, "", "/settings/x-accounts")
        }
    }, [searchParams])

    // Clear message after 5 seconds
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000)
            return () => clearTimeout(timer)
        }
    }, [message])

    const fetchAccounts = useCallback(async () => {
        if (!currentWorkspaceId) return
        setIsLoading(true)
        try {
            const res = await fetch(`/api/x-accounts?workspaceId=${currentWorkspaceId}`)
            if (res.ok) {
                const data = await res.json()
                setAccounts(data.accounts || [])
            }
        } catch (error) {
            console.error("Failed to fetch X accounts:", error)
        } finally {
            setIsLoading(false)
        }
    }, [currentWorkspaceId])

    useEffect(() => {
        fetchAccounts()
    }, [fetchAccounts])

    const handleConnect = async () => {
        if (!currentWorkspaceId) return
        setIsConnecting(true)
        try {
            const res = await fetch("/api/x-accounts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ workspaceId: currentWorkspaceId }),
            })
            if (res.ok) {
                const data = await res.json()
                // Redirect to X authorization page
                window.location.href = data.authUrl
            } else {
                setMessage({ type: "error", text: "无法发起授权请求" })
                setIsConnecting(false)
            }
        } catch (error) {
            console.error("Failed to initiate OAuth:", error)
            setMessage({ type: "error", text: "网络错误，请重试" })
            setIsConnecting(false)
        }
    }

    const handleSetDefault = async (id: string) => {
        try {
            await fetch(`/api/x-accounts/${id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isDefault: true }),
            })
            await fetchAccounts()
        } catch (error) {
            console.error("Failed to set default:", error)
        }
    }

    const handleRefresh = async (id: string) => {
        setRefreshingId(id)
        try {
            const res = await fetch("/api/x-accounts/refresh", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ accountId: id }),
            })
            if (res.ok) {
                setMessage({ type: "success", text: "Token 刷新成功" })
                await fetchAccounts()
            } else {
                setMessage({ type: "error", text: "Token 刷新失败" })
            }
        } catch (error) {
            console.error("Failed to refresh token:", error)
            setMessage({ type: "error", text: "网络错误" })
        } finally {
            setRefreshingId(null)
        }
    }

    const handleDelete = async () => {
        if (!deleteId) return
        try {
            await fetch(`/api/x-accounts/${deleteId}`, { method: "DELETE" })
            await fetchAccounts()
            setMessage({ type: "success", text: "账号已解绑" })
        } catch (error) {
            console.error("Failed to delete account:", error)
            setMessage({ type: "error", text: "解绑失败" })
        } finally {
            setDeleteId(null)
        }
    }

    return (
        <PageShell
            title="X 账号"
            description="管理您的 X (Twitter) 账号，用于发布内容"
        >
            <div className="max-w-4xl mx-auto space-y-6">
                {/* Message banner */}
                {message && (
                    <div
                        className={cn(
                            "p-4 rounded-lg flex items-center gap-2",
                            message.type === "success"
                                ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                                : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                        )}
                    >
                        {message.type === "success" ? (
                            <CheckCircle2 className="h-5 w-5" />
                        ) : (
                            <AlertCircle className="h-5 w-5" />
                        )}
                        {message.text}
                    </div>
                )}

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-lg font-semibold">已绑定账号</h2>
                        <p className="text-sm text-muted-foreground">
                            绑定 X 账号后可以直接发布内容
                        </p>
                    </div>
                    <Button onClick={handleConnect} disabled={isConnecting}>
                        {isConnecting ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                连接中...
                            </>
                        ) : (
                            <>
                                <Plus className="h-4 w-4 mr-2" />
                                绑定 X 账号
                            </>
                        )}
                    </Button>
                </div>

                {/* Loading state */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : accounts.length === 0 ? (
                    /* Empty state */
                    <Card className="border-dashed">
                        <CardContent className="flex flex-col items-center justify-center py-12">
                            <Twitter className="h-12 w-12 text-muted-foreground/50 mb-4" />
                            <h3 className="font-medium mb-1">还没有绑定 X 账号</h3>
                            <p className="text-sm text-muted-foreground mb-4">
                                绑定您的 X 账号以启用一键发布功能
                            </p>
                            <Button onClick={handleConnect} disabled={isConnecting}>
                                {isConnecting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        连接中...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        绑定 X 账号
                                    </>
                                )}
                            </Button>
                        </CardContent>
                    </Card>
                ) : (
                    /* Account list */
                    <div className="grid gap-4">
                        {accounts.map((account) => (
                            <XAccountCard
                                key={account.id}
                                account={account}
                                isRefreshing={refreshingId === account.id}
                                onSetDefault={() => handleSetDefault(account.id)}
                                onRefresh={() => handleRefresh(account.id)}
                                onDelete={() => setDeleteId(account.id)}
                            />
                        ))}
                    </div>
                )}

                {/* Delete confirmation dialog */}
                <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>确认解绑</AlertDialogTitle>
                            <AlertDialogDescription>
                                解绑后将无法使用此账号发布内容。已发布的内容不会受到影响。
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700">
                                解绑
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </div>
        </PageShell>
    )
}

function XAccountCard({
    account,
    isRefreshing,
    onSetDefault,
    onRefresh,
    onDelete,
}: {
    account: XAccount
    isRefreshing: boolean
    onSetDefault: () => void
    onRefresh: () => void
    onDelete: () => void
}) {
    const tokenStatusConfig = {
        valid: { label: "有效", color: "text-green-600 border-green-200", icon: CheckCircle2 },
        expiring: { label: "即将过期", color: "text-amber-600 border-amber-200", icon: Clock },
        expired: { label: "已过期", color: "text-red-600 border-red-200", icon: AlertCircle },
        unknown: { label: "未知", color: "text-gray-600 border-gray-200", icon: AlertCircle },
    }

    const status = tokenStatusConfig[account.tokenStatus]
    const StatusIcon = status.icon

    return (
        <Card className={cn(account.isDefault && "ring-2 ring-primary/20")}>
            <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        {account.xAvatar ? (
                            <img
                                src={account.xAvatar}
                                alt={account.xUsername}
                                className="h-10 w-10 rounded-full"
                            />
                        ) : (
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                                <Twitter className="h-5 w-5 text-muted-foreground" />
                            </div>
                        )}
                        <div>
                            <div className="flex items-center gap-2">
                                <CardTitle className="text-base">
                                    {account.xDisplayName || account.xUsername}
                                </CardTitle>
                                {account.isDefault && (
                                    <Badge variant="secondary" className="text-xs">
                                        <Star className="h-3 w-3 mr-1 fill-current" />
                                        默认
                                    </Badge>
                                )}
                            </div>
                            <CardDescription className="flex items-center gap-1">
                                @{account.xUsername}
                                <a
                                    href={`https://x.com/${account.xUsername}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-muted-foreground hover:text-foreground"
                                >
                                    <ExternalLink className="h-3 w-3" />
                                </a>
                            </CardDescription>
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        {!account.isDefault && (
                            <Button variant="ghost" size="sm" onClick={onSetDefault} title="设为默认">
                                <Star className="h-4 w-4" />
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={onRefresh}
                            disabled={isRefreshing}
                            title="刷新 Token"
                        >
                            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            onClick={onDelete}
                            title="解绑"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                        <Badge variant="outline" className={cn("text-xs", status.color)}>
                            <StatusIcon className="h-3 w-3 mr-1" />
                            Token {status.label}
                        </Badge>
                    </div>
                    {account.tokenExpiry && (
                        <span className="text-muted-foreground">
                            过期时间: {new Date(account.tokenExpiry).toLocaleDateString("zh-CN")}
                        </span>
                    )}
                    {account.lastError && (
                        <span className="text-red-600 text-xs">{account.lastError}</span>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
