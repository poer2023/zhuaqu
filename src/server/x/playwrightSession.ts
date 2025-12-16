import { chromium, type Browser, type BrowserContext } from "playwright"
import path from "path"
import { access, mkdir } from "fs/promises"

const DATA_DIR = path.join(process.cwd(), ".playwright-data")
export const X_SESSION_PATH = path.join(DATA_DIR, "x-session")

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

  const storageState = (await hasXSession()) ? X_SESSION_PATH : undefined

  context = await browser.newContext({
    ...(storageState ? { storageState } : {}),
    viewport: { width: 1280, height: 800 },
    userAgent:
      process.env.X_USER_AGENT?.trim() ||
      process.env.YTDLP_USER_AGENT?.trim() ||
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  })
  contextHeadless = headless
  return context
}

export async function saveXSession(context: BrowserContext): Promise<void> {
  await ensureDataDir()
  await context.storageState({ path: X_SESSION_PATH })
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

