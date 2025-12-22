import { getServerSession, type NextAuthOptions } from "next-auth"
import GoogleProvider from "next-auth/providers/google"

export const authOptions: NextAuthOptions = {
    providers: [
        GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID ?? "",
            clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
        }),
    ],
    pages: {
        signIn: "/login",
        error: "/login",
    },
    callbacks: {
        async signIn({ user }) {
            // 可选: 限制允许登录的邮箱域名
            const allowedDomains = process.env.AUTH_ALLOWED_DOMAINS?.split(",") || []
            if (allowedDomains.length > 0 && user.email) {
                const domain = user.email.split("@")[1]
                return allowedDomains.includes(domain)
            }
            return true
        },
        async session({ session, token }) {
            if (session.user && token.sub) {
                session.user.id = token.sub
            }
            return session
        },
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id
            }
            return token
        },
    },
    session: {
        strategy: "jwt",
        maxAge: 30 * 24 * 60 * 60, // 30 days
    },
    secret: process.env.NEXTAUTH_SECRET,
}

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
