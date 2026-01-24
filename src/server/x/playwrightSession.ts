import { chromium } from "playwright-extra"
import StealthPlugin from "puppeteer-extra-plugin-stealth"
import type { Browser, BrowserContext, Cookie } from "playwright"
import path from "path"
import { access, mkdir, readFile } from "fs/promises"

// 添加 Stealth 插件绕过自动化检测
chromium.use(StealthPlugin())

const DATA_DIR = path.join(process.cwd(), ".playwright-data")
export const X_SESSION_PATH = path.join(DATA_DIR, "x-session")
export const X_COOKIES_PATH = process.env.X_COOKIES_PATH || path.join(DATA_DIR, "x-cookies.txt")

let browser: Browser | null = null
let context: BrowserContext | null = null
let contextHeadless: boolean | null = null

async function ensureDataDir(): Promise<void> {
  try {
    await access(DATA_DIR)
  } catch {
    await mkdir(DATA_DIR, { recursive: true })
  }
}

export async function hasXSession(): Promise<boolean> {
  try {
    await access(X_SESSION_PATH)
    return true
  } catch {
    return false
  }
}

/**
 * 检查是否存在 cookies 文件
 */
export async function hasXCookiesFile(): Promise<boolean> {
  try {
    await access(X_COOKIES_PATH)
    return true
  } catch {
    return false
  }
}

/**
 * 解析 Netscape cookies.txt 格式文件
 * 格式: domain\tincludeSubdomains\tpath\tsecure\texpiry\tname\tvalue
 */
async function parseNetscapeCookies(filePath: string): Promise<Cookie[]> {
  const content = await readFile(filePath, "utf-8")
  const lines = content.split("\n")
  const cookies: Cookie[] = []

  for (const line of lines) {
    // 跳过注释和空行
    if (line.startsWith("#") || line.trim() === "") continue

    const parts = line.split("\t")
    if (parts.length < 7) continue

    const [domain, , path, secure, expiry, name, value] = parts

    // 只加载 X/Twitter 相关的 cookies
    if (!domain.includes("twitter.com") && !domain.includes("x.com")) continue

    cookies.push({
      name: name.trim(),
      value: value.trim(),
      domain: domain.startsWith(".") ? domain : `.${domain}`,
      path: path || "/",
      expires: parseInt(expiry) || -1,
      httpOnly: false,
      secure: secure.toUpperCase() === "TRUE",
      sameSite: "Lax",
    })
  }

  return cookies
}

/**
 * 从 JSON 格式的 cookies 文件加载 (Cookie-Editor 导出的 JSON 格式)
 */
async function parseJsonCookies(filePath: string): Promise<Cookie[]> {
  const content = await readFile(filePath, "utf-8")
  const rawCookies = JSON.parse(content)
  const cookies: Cookie[] = []

  for (const c of rawCookies) {
    // 只加载 X/Twitter 相关的 cookies
    if (!c.domain?.includes("twitter.com") && !c.domain?.includes("x.com")) continue

    // 转换 sameSite 值
    let sameSite: "Strict" | "Lax" | "None" = "Lax"
    if (c.sameSite === "no_restriction") sameSite = "None"
    else if (c.sameSite === "lax") sameSite = "Lax"
    else if (c.sameSite === "strict") sameSite = "Strict"

    cookies.push({
      name: c.name,
      value: c.value,
      domain: c.domain.startsWith(".") ? c.domain : `.${c.domain}`,
      path: c.path || "/",
      expires: c.expirationDate || -1,
      httpOnly: c.httpOnly || false,
      secure: c.secure || false,
      sameSite,
    })
  }

  return cookies
}

/**
 * 加载 cookies 文件（支持 Netscape txt 和 JSON 格式）
 */
async function loadCookiesFromFile(filePath: string): Promise<Cookie[]> {
  const content = await readFile(filePath, "utf-8")
  const trimmed = content.trim()

  // 判断是 JSON 还是 Netscape 格式
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    console.log("[Cookies] Loading JSON format cookies file")
    return parseJsonCookies(filePath)
  } else {
    console.log("[Cookies] Loading Netscape format cookies file")
    return parseNetscapeCookies(filePath)
  }
}

export async function launchXSessionContext(args?: { headless?: boolean; slowMo?: number }): Promise<BrowserContext> {
  const headless = args?.headless ?? true
  const slowMo = args?.slowMo ?? 0

  if (context && contextHeadless === headless) return context

  await closeXSession()
  await ensureDataDir()

  browser = await chromium.launch({
    headless,
    slowMo,
  })

  // 优先使用 cookies 文件，其次使用保存的 session
  const hasCookies = await hasXCookiesFile()
  const hasSession = await hasXSession()

  context = await browser.newContext({
    ...(hasSession && !hasCookies ? { storageState: X_SESSION_PATH } : {}),
    viewport: { width: 1280, height: 800 },
    userAgent:
      process.env.X_USER_AGENT?.trim() ||
      process.env.YTDLP_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })

  // 如果有 cookies 文件，加载到 context
  if (hasCookies) {
    try {
      const cookies = await loadCookiesFromFile(X_COOKIES_PATH)
      if (cookies.length > 0) {
        await context.addCookies(cookies)
        console.log(`[Cookies] Loaded ${cookies.length} cookies from file`)
      }
    } catch (err) {
      console.error("[Cookies] Failed to load cookies file:", err)
    }
  }

  contextHeadless = headless
  return context
}

export async function saveXSession(ctx: BrowserContext): Promise<void> {
  await ensureDataDir()
  await ctx.storageState({ path: X_SESSION_PATH })
}

export async function closeXSession(): Promise<void> {
  if (context) {
    await context.close()
    context = null
  }
  if (browser) {
    await browser.close()
    browser = null
  }
  contextHeadless = null
}
