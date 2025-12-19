import { withAuth } from "next-auth/middleware"
import { NextResponse } from "next/server"

// 开发模式下跳过认证检查
const isAuthEnabled = process.env.AUTH_ENABLED === "true"

export default withAuth(
    function middleware(_req) {
        // 如果认证未启用，直接放行
        if (!isAuthEnabled) {
            return NextResponse.next()
        }
        return NextResponse.next()
    },
    {
        callbacks: {
            authorized: ({ token }) => {
                // 如果认证未启用，始终返回 true
                if (!isAuthEnabled) {
                    return true
                }
                return !!token
            },
        },
        pages: {
            signIn: "/login",
        },
    }
)

// 配置需要保护的路由
export const config = {
    matcher: [
        /*
         * 匹配所有路径，除了:
         * - api/auth (认证 API)
         * - login (登录页)
         * - _next (Next.js 内部)
         * - 静态文件
         */
        "/((?!api/auth|login|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)",
    ],
}
