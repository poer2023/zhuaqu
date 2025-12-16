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

import { chromium, Browser, BrowserContext, Page } from "playwright"
import path from "path"
import { mkdir, access } from "fs/promises"
import { AppError, getErrorMessage } from "@/server/errors"

// 存储目录
const DATA_DIR = path.join(process.cwd(), ".playwright-data")
const CONTEXT_PATH = path.join(DATA_DIR, "x-session")

// X 选择器 (可能需要根据 UI 变化更新)
const SELECTORS = {
    // 登录检测
    homeTimeline: '[data-testid="primaryColumn"]',
    loginButton: '[data-testid="loginButton"]',

    // 发推
    tweetButton: '[data-testid="SideNav_NewTweet_Button"]',
    tweetTextarea: '[data-testid="tweetTextarea_0"]',
    tweetSubmitButton: '[data-testid="tweetButtonInline"]',

    // 发推对话框
    tweetDialog: '[data-testid="toolBar"]',
    tweetDialogTextarea: '[data-testid="tweetTextarea_0"]',
    tweetDialogSubmit: '[data-testid="tweetButton"]',

    // 成功指示
    tweetPosted: '[data-testid="toast"]',
}

let browser: Browser | null = null
let context: BrowserContext | null = null

/**
 * 确保数据目录存在
 */
async function ensureDataDir() {
    try {
        await access(DATA_DIR)
    } catch {
        await mkdir(DATA_DIR, { recursive: true })
    }
}

/**
 * 检查是否有已保存的登录会话
 */
export async function hasSession(): Promise<boolean> {
    try {
        await access(CONTEXT_PATH)
        return true
    } catch {
        return false
    }
}

/**
 * 启动浏览器并加载会话
 */
async function launchBrowser(): Promise<BrowserContext> {
    if (context) return context

    await ensureDataDir()

    browser = await chromium.launch({
        headless: false, // 第一次登录需要可见浏览器
        slowMo: 50,
    })

    const hasExistingSession = await hasSession()

    if (hasExistingSession) {
        context = await browser.newContext({
            storageState: CONTEXT_PATH,
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
    } else {
        context = await browser.newContext({
            viewport: { width: 1280, height: 800 },
            userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        })
    }

    return context
}

/**
 * 关闭浏览器
 */
export async function closeBrowser() {
    if (context) {
        await context.close()
        context = null
    }
    if (browser) {
        await browser.close()
        browser = null
    }
}

/**
 * 打开登录页面让用户手动登录
 * 登录成功后会自动保存会话
 */
export async function openLoginPage(): Promise<{ success: boolean; message: string }> {
    try {
        const ctx = await launchBrowser()
        const page = await ctx.newPage()

        await page.goto("https://x.com/login", { waitUntil: "networkidle" })

        // 等待用户登录 (最多 5 分钟)
        console.log("请在浏览器中登录 X 账号...")

        try {
            await page.waitForSelector(SELECTORS.homeTimeline, { timeout: 300_000 })

            // 保存会话
            await ctx.storageState({ path: CONTEXT_PATH })
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
    try {
        await page.goto("https://x.com/home", { waitUntil: "networkidle", timeout: 30_000 })

        // 检查是否显示首页时间线
        const timeline = await page.$(SELECTORS.homeTimeline)
        if (timeline) return true

        // 检查是否显示登录按钮
        const loginBtn = await page.$(SELECTORS.loginButton)
        if (loginBtn) return false

        return false
    } catch {
        return false
    }
}

/**
 * 发送单条推文
 */
export async function postTweet(text: string): Promise<{
    success: boolean
    tweetUrl?: string
    error?: string
}> {
    try {
        const ctx = await launchBrowser()
        const page = await ctx.newPage()

        // 检查登录状态
        const isLoggedIn = await checkLogin(page)
        if (!isLoggedIn) {
            return { success: false, error: "未登录，请先执行登录流程" }
        }

        // 点击发推按钮
        await page.click(SELECTORS.tweetButton)
        await page.waitForTimeout(500)

        // 等待输入框出现
        await page.waitForSelector(SELECTORS.tweetDialogTextarea, { timeout: 5000 })

        // 输入内容
        await page.fill(SELECTORS.tweetDialogTextarea, text)
        await page.waitForTimeout(300)

        // 点击发送
        await page.click(SELECTORS.tweetDialogSubmit)

        // 等待发送成功提示
        try {
            await page.waitForSelector(SELECTORS.tweetPosted, { timeout: 10_000 })
        } catch {
            // Toast 可能很快消失，忽略
        }

        // 等待一下确保发送完成
        await page.waitForTimeout(2000)

        // 尝试获取发送的推文 URL (从用户主页)
        // 这部分比较复杂，暂时返回成功即可

        // 保存更新后的会话
        await ctx.storageState({ path: CONTEXT_PATH })

        return { success: true }
    } catch (error) {
        return { success: false, error: getErrorMessage(error) }
    }
}

/**
 * 发送线程 (多条连续推文)
 */
export async function postThread(tweets: string[]): Promise<{
    success: boolean
    results: Array<{ index: number; success: boolean; error?: string }>
}> {
    if (tweets.length === 0) {
        return { success: false, results: [] }
    }

    const results: Array<{ index: number; success: boolean; error?: string }> = []

    try {
        const ctx = await launchBrowser()
        const page = await ctx.newPage()

        // 检查登录状态
        const isLoggedIn = await checkLogin(page)
        if (!isLoggedIn) {
            return {
                success: false,
                results: tweets.map((_, i) => ({ index: i, success: false, error: "未登录" }))
            }
        }

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

                results.push({ index: i, success: true })
            } catch (error) {
                results.push({ index: i, success: false, error: getErrorMessage(error) })
            }
        }

        // 发送整个线程
        await page.click(SELECTORS.tweetDialogSubmit)

        // 等待发送完成
        await page.waitForTimeout(3000)

        // 保存会话
        await ctx.storageState({ path: CONTEXT_PATH })

        const allSuccess = results.every(r => r.success)
        return { success: allSuccess, results }
    } catch (error) {
        return {
            success: false,
            results: tweets.map((_, i) => ({
                index: i,
                success: false,
                error: results[i]?.error || getErrorMessage(error)
            }))
        }
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
    try {
        const ctx = await launchBrowser()
        const page = await ctx.newPage()

        const isLoggedIn = await checkLogin(page)
        if (!isLoggedIn) {
            return { isLoggedIn: false }
        }

        // 尝试获取用户名 (从侧边栏)
        try {
            const accountButton = await page.$('[data-testid="SideNav_AccountSwitcher_Button"]')
            if (accountButton) {
                const text = await accountButton.textContent()
                // 解析用户名 (格式通常是 "Display Name @username")
                const match = text?.match(/@(\w+)/)
                if (match) {
                    return {
                        isLoggedIn: true,
                        username: match[1],
                        displayName: text?.replace(/@\w+/, "").trim(),
                    }
                }
            }
        } catch {
            // 忽略解析错误
        }

        return { isLoggedIn: true }
    } catch {
        return { isLoggedIn: false }
    }
}
