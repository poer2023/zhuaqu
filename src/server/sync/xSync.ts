import type { Page } from "playwright"
import { AppError } from "@/server/errors"
import { launchXSessionContext } from "@/server/x/playwrightSession"
import { getXLoggedInUser, X_WEB_SELECTORS } from "@/server/x/xWeb"
import { parseTweetUrl } from "@/server/x/parseTweetUrl"

export type SyncSource = "LIKES" | "BOOKMARKS" | "TIMELINE"

function normalizeHref(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) return href
  if (href.startsWith("/")) return `https://x.com${href}`
  return `https://x.com/${href}`
}

async function extractTweetLinks(page: Page): Promise<string[]> {
  const hrefs = await page.$$eval('a[href*="/status/"]', (els) =>
    els
      .map((el) => (el instanceof HTMLAnchorElement ? el.getAttribute("href") : null))
      .filter((v): v is string => typeof v === "string" && v.length > 0)
  )
  return hrefs
}

async function scrollPage(page: Page): Promise<void> {
  await page.mouse.wheel(0, 1800)
  await page.waitForTimeout(800)
}

export async function collectTweetUrlsFromSource(args: {
  source: SyncSource
  limit: number
}): Promise<{ urls: string[]; username?: string }> {
  const ctx = await launchXSessionContext({ headless: true })
  const page = await ctx.newPage()

  const userInfo = await getXLoggedInUser(page)
  if (!userInfo.isLoggedIn) {
    throw new AppError("X_SESSION_REQUIRED", "X browser session not connected. Please login in Settings → Integrations.")
  }

  const username = userInfo.username
  if (!username) {
    throw new AppError("X_SESSION_USER_UNKNOWN", "Failed to detect X username from session.")
  }

  const targetUrl =
    args.source === "LIKES"
      ? `https://x.com/${username}/likes`
      : args.source === "BOOKMARKS"
        ? "https://x.com/i/bookmarks"
        : "https://x.com/home"

  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 60_000 })
  await page.waitForSelector(X_WEB_SELECTORS.homeTimeline, { timeout: 30_000 }).catch(() => null)

  const urls = new Set<string>()
  let noNewRounds = 0

  const maxRounds = 60
  for (let round = 0; round < maxRounds && urls.size < args.limit; round++) {
    const hrefs = await extractTweetLinks(page)
    const before = urls.size

    for (const href of hrefs) {
      const parsed = parseTweetUrl(normalizeHref(href))
      if (!parsed) continue
      urls.add(parsed.canonicalUrl)
      if (urls.size >= args.limit) break
    }

    if (urls.size === before) {
      noNewRounds++
    } else {
      noNewRounds = 0
    }

    if (noNewRounds >= 6) break
    await scrollPage(page)
  }

  await page.close().catch(() => null)

  return { urls: Array.from(urls).slice(0, args.limit), username }
}

