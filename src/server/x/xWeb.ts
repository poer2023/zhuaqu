import type { Page } from "playwright"

export const X_WEB_SELECTORS = {
  homeTimeline: '[data-testid="primaryColumn"]',
  loginButton: '[data-testid="loginButton"]',
  accountSwitcherButton: '[data-testid="SideNav_AccountSwitcher_Button"]',
  toast: '[data-testid="toast"]',
} as const

export async function checkXLogin(page: Page): Promise<boolean> {
  try {
    await page.goto("https://x.com/home", { waitUntil: "networkidle", timeout: 30_000 })

    const timeline = await page.$(X_WEB_SELECTORS.homeTimeline)
    if (timeline) return true

    const loginBtn = await page.$(X_WEB_SELECTORS.loginButton)
    if (loginBtn) return false

    return false
  } catch {
    return false
  }
}

export async function getXLoggedInUser(page: Page): Promise<{
  isLoggedIn: boolean
  username?: string
  displayName?: string
}> {
  const isLoggedIn = await checkXLogin(page)
  if (!isLoggedIn) return { isLoggedIn: false }

  try {
    const accountButton = await page.$(X_WEB_SELECTORS.accountSwitcherButton)
    if (!accountButton) return { isLoggedIn: true }

    const text = await accountButton.textContent()
    const match = text?.match(/@(\w+)/)
    if (!match) return { isLoggedIn: true }

    return {
      isLoggedIn: true,
      username: match[1],
      displayName: text?.replace(/@\w+/, "").trim() || undefined,
    }
  } catch {
    return { isLoggedIn: true }
  }
}

