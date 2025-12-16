export type ParsedTweetUrl = {
  input: string
  tweetId: string
  canonicalUrl: string
  authorHandle: string | null
}

export function parseTweetUrl(input: string): ParsedTweetUrl | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const idOnly = trimmed.match(/^\d{6,}$/)?.[0]
  if (idOnly) {
    return {
      input: trimmed,
      tweetId: idOnly,
      canonicalUrl: `https://x.com/i/web/status/${idOnly}`,
      authorHandle: null,
    }
  }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return null
  }

  if (!["x.com", "twitter.com", "www.x.com", "www.twitter.com", "mobile.twitter.com"].includes(url.hostname)) {
    return null
  }

  const pathname = url.pathname
  const idMatch = pathname.match(/\/status\/(\d+)/)
  if (!idMatch) return null

  const tweetId = idMatch[1]
  const parts = pathname.split("/").filter(Boolean)
  const statusIndex = parts.indexOf("status")
  const authorHandle = statusIndex > 0 ? parts[statusIndex - 1] : null
  const isWebStatus = parts[0] === "i" && parts[1] === "web"

  const canonicalUrl =
    authorHandle && !isWebStatus
      ? `https://x.com/${authorHandle}/status/${tweetId}`
      : `https://x.com/i/web/status/${tweetId}`

  return { input: trimmed, tweetId, canonicalUrl, authorHandle: isWebStatus ? null : authorHandle }
}

