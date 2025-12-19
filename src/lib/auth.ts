import { getServerSession } from "next-auth"
import { authOptions } from "@/app/api/auth/[...nextauth]/route"

/**
 * 获取当前用户会话 (服务端组件/API 使用)
 */
export async function getSession() {
    return getServerSession(authOptions)
}

/**
 * 检查是否已认证
 * 如果 AUTH_ENABLED !== "true"，始终返回 true
 */
export async function isAuthenticated(): Promise<boolean> {
    if (process.env.AUTH_ENABLED !== "true") {
        return true
    }
    const session = await getSession()
    return !!session?.user
}

/**
 * 获取当前用户 ID
 * 如果未启用认证，返回 "dev-user"
 */
export async function getCurrentUserId(): Promise<string> {
    if (process.env.AUTH_ENABLED !== "true") {
        return "dev-user"
    }
    const session = await getSession()
    return session?.user?.id ?? "anonymous"
}
