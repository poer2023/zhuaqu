/**
 * Playwright-based X/Twitter Publisher
 * 
 * This module uses browser automation to post tweets via a logged-in session,
 * avoiding the need for API credentials.
 * 
 * Requirements:
 * - User must log in to X once to save the session
 * - Playwright Chromium browser must be installed
 */

import type { BrowserContext, Page, Response } from "playwright"
import { getErrorMessage } from "@/server/errors"
import { closeXSession, hasXSession, launchXSessionContext, saveXSession } from "@/server/x/playwrightSession"
import { checkXLogin, getXLoggedInUser, X_WEB_SELECTORS } from "@/server/x/xWeb"

// X 选择器 (可能需要根据 UI 变化更新)
const SELECTORS = {
    tweetButton: '[data-testid="SideNav_NewTweet_Button"]',
    tweetDialogTextarea: '[data-testid="tweetTextarea_0"]',
    tweetDialogSubmit: '[data-testid="tweetButton"]',
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

function getPath(obj: unknown, path: Array<string | number>): unknown {
    let cur: unknown = obj
    for (const key of path) {
        if (typeof key === "number") {
            if (!Array.isArray(cur)) return undefined
            cur = cur[key]
            continue
        }
        if (!isRecord(cur)) return undefined
        cur = cur[key]
    }
    return cur
}

function asString(value: unknown): string | null {
    return typeof value === "string" ? value : null
}

function extractTweetIdFromCreateTweetResponse(body: unknown): string | null {
    const candidatePaths: Array<Array<string | number>> = [
        ["data", "create_tweet", "tweet_results", "result", "rest_id"],
        ["data", "create_tweet", "tweet_results", "result", "tweet", "rest_id"],
        ["data", "tweet_create", "tweet_results", "result", "rest_id"],
    ]

    for (const p of candidatePaths) {
        const v = asString(getPath(body, p))
        if (v) return v
    }

    return null
}

async function captureCreateTweetIds(
    page: Page,
    args?: { timeoutMs?: number; expectCount?: number }
): Promise<string[]> {
    const timeoutMs = args?.timeoutMs ?? 15_000
    const expectCount = args?.expectCount ?? 1

    return new Promise((resolve) => {
        const ids: string[] = []
        let done = false
        let listener: ((response: Response) => void) | null = null

        const finish = () => {
            if (done) return
            done = true
            if (listener) page.off("response", listener)
            resolve(ids)
        }

        const timer = setTimeout(finish, timeoutMs)

        listener = async (response: Response) => {
            const url = response.url()
            if (!url.includes("/CreateTweet")) return
            const json = await response.json().catch(() => null)
            const id = extractTweetIdFromCreateTweetResponse(json)
            if (!id) return
            ids.push(id)
            if (ids.length >= expectCount) {
                clearTimeout(timer)
                finish()
            }
        }

        page.on("response", listener)
    })
}

function buildTweetUrl(tweetId: string, username?: string): string {
    if (username) return `https://x.com/${username}/status/${tweetId}`
    return `https://x.com/i/web/status/${tweetId}`
}

function extractTweetIdFromStatusUrl(url: string): string | null {
    const match = url.match(/\/status\/(\d+)/)
    return match?.[1] ?? null
}

async function tryGetTweetUrlFromToast(page: Page): Promise<string | null> {
    try {
        const href = await page.$eval(`${X_WEB_SELECTORS.toast} a[href*="/status/"]`, (el) => (el as HTMLAnchorElement).getAttribute("href"))
        if (typeof href !== "string" || !href.trim()) return null
        return href.startsWith("http") ? href : `https://x.com${href.startsWith("/") ? "" : "/"}${href}`
    } catch {
        return null
    }
}

async function tryFindTweetUrlOnProfile(page: Page, args: { username: string; text: string }): Promise<string | null> {
    const snippet = args.text.replace(/\s+/g, " ").trim().slice(0, 80)
    if (!snippet) return null

    try {
        await page.goto(`https://x.com/${args.username}`, { waitUntil: "networkidle", timeout: 60_000 })
        await page.waitForTimeout(1500)

        const href = await page.$$eval(
            "article",
            (articles, needle) => {
                const target = String(needle || "")
                for (const a of articles) {
                    const txt = (a as HTMLElement).innerText || ""
                    if (!txt.includes(target)) continue
                    const link = a.querySelector('a[href*="/status/"]') as HTMLAnchorElement | null
                    if (link?.href) return link.href
                }
                return null
            },
            snippet
        )

        if (typeof href !== "string" || !href.trim()) return null
        return href
    } catch {
        return null
    }
}

/**
 * 检查是否有已保存的登录会话
 */
export async function hasSession(): Promise<boolean> {
    return hasXSession()
}

/**
 * 启动浏览器并加载会话
 */
async function launchBrowser(options?: { headless?: boolean; slowMo?: number }): Promise<BrowserContext> {
    const headless = options?.headless ?? (process.env.PUBLISH_HEADLESS || "true") !== "false"
    const slowMo = options?.slowMo ?? 0
    return launchXSessionContext({ headless, slowMo })
}

/**
 * 关闭浏览器
 */
export async function closeBrowser() {
    await closeXSession()
}

/**
 * 打开登录页面让用户手动登录
 * 登录成功后会自动保存会话
 */
export async function openLoginPage(): Promise<{ success: boolean; message: string }> {
    try {
        const ctx = await launchBrowser({ headless: false, slowMo: 50 })
        const page = await ctx.newPage()

        await page.goto("https://x.com/login", { waitUntil: "networkidle" })

        // 等待用户登录 (最多 5 分钟)
        console.log("请在浏览器中登录 X 账号...")

        try {
            await page.waitForSelector(X_WEB_SELECTORS.homeTimeline, { timeout: 300_000 })

            // 保存会话
            await saveXSession(ctx)
            console.log("登录成功，会话已保存！")

            return { success: true, message: "登录成功，会话已保存" }
        } catch {
            return { success: false, message: "登录超时或失败" }
        }
    } catch (error) {
        return { success: false, message: getErrorMessage(error) }
    }
}

/**
 * 检查是否已登录
 */
async function checkLogin(page: Page): Promise<boolean> {
    return checkXLogin(page)
}

/**
 * 发送单条推文
 */
export async function postTweet(text: string): Promise<{
    success: boolean
    tweetId?: string
    tweetUrl?: string
    error?: string
}> {
    let page: Page | null = null

    try {
        const ctx = await launchBrowser()
        page = await ctx.newPage()

        // 检查登录状态
        const isLoggedIn = await checkLogin(page)
        if (!isLoggedIn) {
            return { success: false, error: "未登录，请先执行登录流程" }
        }

        const userInfo = await getXLoggedInUser(page)

        // 点击发推按钮
        await page.click(SELECTORS.tweetButton)
        await page.waitForTimeout(500)

        // 等待输入框出现
        await page.waitForSelector(SELECTORS.tweetDialogTextarea, { timeout: 5000 })

        // 输入内容
        await page.fill(SELECTORS.tweetDialogTextarea, text)
        await page.waitForTimeout(300)

        // 点击发送
        const capture = captureCreateTweetIds(page, { expectCount: 1 })
        await page.click(SELECTORS.tweetDialogSubmit)

        // 等待发送成功提示
        try {
            await page.waitForSelector(X_WEB_SELECTORS.toast, { timeout: 10_000 })
        } catch {
            // Toast 可能很快消失，忽略
        }

        // 等待一下确保发送完成
        await page.waitForTimeout(2000)

        const ids = await capture
        let tweetId = ids[0]
        let tweetUrl = tweetId ? buildTweetUrl(tweetId, userInfo.username) : undefined

        if (!tweetId) {
            const toastUrl = await tryGetTweetUrlFromToast(page)
            const toastId = toastUrl ? extractTweetIdFromStatusUrl(toastUrl) : null
            if (toastUrl && toastId) {
                tweetId = toastId
                tweetUrl = toastUrl
            }
        }

        if (!tweetId && userInfo.username) {
            const profileUrl = await tryFindTweetUrlOnProfile(page, { username: userInfo.username, text })
            const profileId = profileUrl ? extractTweetIdFromStatusUrl(profileUrl) : null
            if (profileUrl && profileId) {
                tweetId = profileId
                tweetUrl = profileUrl
            }
        }

        // 保存更新后的会话
        await saveXSession(ctx)

        return { success: true, tweetId, tweetUrl }
    } catch (error) {
        return { success: false, error: getErrorMessage(error) }
    } finally {
        await page?.close().catch(() => null)
    }
}

/**
 * 发送线程 (多条连续推文)
 */
export async function postThread(tweets: string[]): Promise<{
    success: boolean
    results: Array<{ index: number; success: boolean; tweetId?: string; tweetUrl?: string; error?: string }>
}> {
    if (tweets.length === 0) {
        return { success: false, results: [] }
    }

    const results: Array<{ index: number; success: boolean; tweetId?: string; tweetUrl?: string; error?: string }> = tweets.map((_, i) => ({
        index: i,
        success: false,
    }))

    let page: Page | null = null

    try {
        const ctx = await launchBrowser()
        page = await ctx.newPage()

        // 检查登录状态
        const isLoggedIn = await checkLogin(page)
        if (!isLoggedIn) {
            return {
                success: false,
                results: tweets.map((_, i) => ({ index: i, success: false, error: "未登录" }))
            }
        }

        const userInfo = await getXLoggedInUser(page)

        // 点击发推按钮打开对话框
        await page.click(SELECTORS.tweetButton)
        await page.waitForSelector(SELECTORS.tweetDialogTextarea, { timeout: 5000 })

        for (let i = 0; i < tweets.length; i++) {
            const text = tweets[i]

            try {
                if (i > 0) {
                    // 点击添加线程按钮 (通常是 "+" 按钮)
                    const addButton = await page.$('[data-testid="addButton"]')
                    if (addButton) {
                        await addButton.click()
                        await page.waitForTimeout(300)
                    }

                    // 等待新的输入框
                    await page.waitForSelector(`[data-testid="tweetTextarea_${i}"]`, { timeout: 3000 })
                }

                // 输入内容
                await page.fill(`[data-testid="tweetTextarea_${i}"]`, text)
                await page.waitForTimeout(200)
            } catch (error) {
                results[i] = { index: i, success: false, error: getErrorMessage(error) }
                return { success: false, results }
            }
        }

        // 发送整个线程
        const capture = captureCreateTweetIds(page, { expectCount: tweets.length })
        await page.click(SELECTORS.tweetDialogSubmit)

        // 等待发送完成
        await page.waitForTimeout(3000)

        // 保存会话
        await saveXSession(ctx)

        const ids = await capture
        for (let i = 0; i < tweets.length; i++) {
            const tweetId = ids[i]
            if (!tweetId) {
                results[i] = { ...results[i], success: false, error: results[i].error || "Tweet id not captured" }
                continue
            }
            results[i] = {
                ...results[i],
                success: true,
                tweetId,
                tweetUrl: buildTweetUrl(tweetId, userInfo.username),
            }
        }

        const allSuccess = results.every(r => r.success)
        return { success: allSuccess, results }
    } catch (error) {
        return {
            success: false,
            results: tweets.map((_, i) => ({
                index: i,
                success: false,
                error: results[i]?.error || getErrorMessage(error),
            }))
        }
    } finally {
        await page?.close().catch(() => null)
    }
}

/**
 * 获取当前登录的用户信息
 */
export async function getLoggedInUser(): Promise<{
    isLoggedIn: boolean
    username?: string
    displayName?: string
}> {
    let page: Page | null = null
    try {
        const ctx = await launchBrowser()
        page = await ctx.newPage()

        return getXLoggedInUser(page)
    } catch {
        return { isLoggedIn: false }
    } finally {
        await page?.close().catch(() => null)
    }
}
