import { NextRequest, NextResponse } from "next/server"
import {
    openLoginPage,
    hasSession,
    postTweet,
    postThread,
    getLoggedInUser,
    closeBrowser
} from "@/server/publish/xPublisher"

// GET /api/publish/browser - 获取浏览器登录状态
export async function GET() {
    try {
        const session = await hasSession()

        if (!session) {
            return NextResponse.json({
                isLoggedIn: false,
                hasSession: false,
                message: "No browser session found. Please login first.",
            })
        }

        const userInfo = await getLoggedInUser()

        return NextResponse.json({
            isLoggedIn: userInfo.isLoggedIn,
            hasSession: true,
            username: userInfo.username,
            displayName: userInfo.displayName,
        })
    } catch (error) {
        console.error("Failed to check browser session:", error)
        return NextResponse.json(
            { error: "Failed to check session" },
            { status: 500 }
        )
    }
}

// POST /api/publish/browser - 执行浏览器操作
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { action, text, tweets } = body

        switch (action) {
            case "login": {
                // 打开登录页面
                const result = await openLoginPage()
                return NextResponse.json(result)
            }

            case "post": {
                // 发送单条推文
                if (!text || typeof text !== "string") {
                    return NextResponse.json(
                        { error: "text is required for posting" },
                        { status: 400 }
                    )
                }

                const result = await postTweet(text)
                return NextResponse.json(result)
            }

            case "thread": {
                // 发送线程
                if (!tweets || !Array.isArray(tweets)) {
                    return NextResponse.json(
                        { error: "tweets array is required for thread" },
                        { status: 400 }
                    )
                }

                const result = await postThread(tweets)
                return NextResponse.json(result)
            }

            case "close": {
                // 关闭浏览器
                await closeBrowser()
                return NextResponse.json({ success: true, message: "Browser closed" })
            }

            default:
                return NextResponse.json(
                    { error: "Unknown action. Use: login, post, thread, close" },
                    { status: 400 }
                )
        }
    } catch (error) {
        console.error("Browser publish error:", error)
        return NextResponse.json(
            { error: "Failed to execute browser action" },
            { status: 500 }
        )
    }
}
