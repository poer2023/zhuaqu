// Next.js 16+ proxy.ts 约定
// 取代已弃用的 middleware.ts
// See: https://nextjs.org/docs/messages/middleware-to-proxy

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// 路由重定向映射
const redirects: Record<string, string> = {
    '/': '/content',
    '/ingest': '/content/ingest',
    '/pools': '/content',
    '/rewrite': '/content?filter=rewrite_pending',
    '/sync': '/automation',
    '/audit': '/content?activity=open',
}

export function proxy(request: NextRequest) {
    const pathname = request.nextUrl.pathname

    // 检查是否需要重定向
    if (redirects[pathname]) {
        const url = request.nextUrl.clone()
        const target = redirects[pathname]

        // 解析目标 URL
        const [path, query] = target.split('?')
        url.pathname = path

        if (query) {
            const params = new URLSearchParams(query)
            params.forEach((value, key) => {
                url.searchParams.set(key, value)
            })
        }

        return NextResponse.redirect(url)
    }

    return NextResponse.next()
}

export const config = {
    matcher: [
        '/',
        '/ingest',
        '/pools',
        '/rewrite',
        '/sync',
        '/audit',
    ],
}
