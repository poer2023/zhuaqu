import { getToken } from "next-auth/jwt"
import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// 开发模式下跳过认证检查
const isAuthEnabled = process.env.AUTH_ENABLED === "true"

export async function middleware(request: NextRequest) {
    // 如果认证未启用，直接放行
    if (!isAuthEnabled) {
        return NextResponse.next()
    }

    const token = await getToken({ req: request })

    if (!token) {
        const loginUrl = new URL("/login", request.url)
        loginUrl.searchParams.set("callbackUrl", request.url)
        return NextResponse.redirect(loginUrl)
    }

    return NextResponse.next()
}

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
