import { AppError } from "@/server/errors"

type JsonRecord = Record<string, unknown>

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null
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

const DEFAULT_X_BEARER =
  "AAAAAAAAAAAAAAAAAAAAANRILgAAAAAAnNwIzUejRCOuH5E6I8xnZz4puTs%3D1Zv7ttfk8LF81IUq16cHjhLTvJu4FA33AGWWjCpTnA"

const GRAPHQL_ENDPOINT =
  "https://x.com/i/api/graphql/2ICDjqPd81tulZcYrtpTuQ/TweetResultByRestId"

const GRAPHQL_FEATURES: Record<string, boolean> = {
  creator_subscriptions_tweet_preview_api_enabled: true,
  tweetypie_unmention_optimization_enabled: true,
  responsive_web_edit_tweet_api_enabled: true,
  graphql_is_translatable_rweb_tweet_is_translatable_enabled: true,
  view_counts_everywhere_api_enabled: true,
  longform_notetweets_consumption_enabled: true,
  responsive_web_twitter_article_tweet_consumption_enabled: false,
  tweet_awards_web_tipping_enabled: false,
  freedom_of_speech_not_reach_fetch_enabled: true,
  standardized_nudges_misinfo: true,
  tweet_with_visibility_results_prefer_gql_limited_actions_policy_enabled: true,
  longform_notetweets_rich_text_read_enabled: true,
  longform_notetweets_inline_media_enabled: true,
  responsive_web_graphql_exclude_directive_enabled: true,
  verified_phone_label_enabled: false,
  responsive_web_media_download_video_enabled: false,
  responsive_web_graphql_skip_user_profile_image_extensions_enabled: false,
  responsive_web_graphql_timeline_navigation_enabled: true,
  responsive_web_enhance_cards_enabled: false,
}

const GRAPHQL_FIELD_TOGGLES: Record<string, boolean> = {
  withArticleRichContentState: false,
}

let cachedGuestToken: { token: string; fetchedAt: number } | null = null

async function fetchGuestToken(): Promise<string> {
  const bearer = process.env.X_BEARER_TOKEN?.trim() || DEFAULT_X_BEARER
  const userAgent =
    process.env.X_USER_AGENT?.trim() ||
    process.env.YTDLP_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
  const url = "https://api.x.com/1.1/guest/activate.json"

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${bearer}`,
      "Content-Type": "application/json",
      "User-Agent": userAgent,
      Referer: "https://x.com/",
      Origin: "https://x.com",
      Accept: "application/json",
    },
  })

  if (!res.ok) {
    throw new AppError("X_GUEST_TOKEN_FAILED", `Failed to get guest token (${res.status})`)
  }

  const data = (await res.json().catch(() => null)) as unknown
  const token = isRecord(data) ? asString(data.guest_token) : null
  if (!token) {
    throw new AppError("X_GUEST_TOKEN_FAILED", "Guest token missing in response")
  }
  cachedGuestToken = { token, fetchedAt: Date.now() }
  return token
}

async function getGuestToken(): Promise<string> {
  const maxAgeMs = 30 * 60_000
  if (cachedGuestToken && Date.now() - cachedGuestToken.fetchedAt < maxAgeMs) {
    return cachedGuestToken.token
  }
  return fetchGuestToken()
}

export type ExtractedXMediaImage = {
  url: string
  width: number | null
  height: number | null
  alt: string | null
}

export type ExtractedXMediaVideo = {
  bestUrl: string
  ext: "mp4" | "m3u8" | null
  protocol: "https" | "m3u8_native" | null
  width: number | null
  height: number | null
  tbr: number | null
  thumbnailUrl: string | null
}

export type ExtractedXTweet = {
  authorHandle: string | null
  authorName: string | null
  authorAvatar: string | null
  text: string
  raw: unknown
  images: ExtractedXMediaImage[]
  video: ExtractedXMediaVideo | null
  isReply: boolean
  inReplyToStatusId: string | null
  conversationId: string | null  // Thread root ID
  quotedTweetUrl: string | null  // URL of quoted tweet
}

function toOrigImageUrl(input: string): string {
  try {
    const u = new URL(input)
    const name = u.searchParams.get("name")
    if (name !== "orig") u.searchParams.set("name", "orig")
    if (!u.searchParams.get("format")) {
      const m = u.pathname.match(/\.([a-zA-Z0-9]+)$/)
      if (m) u.searchParams.set("format", m[1].toLowerCase())
    }
    return u.toString()
  } catch {
    return input
  }
}

function pickBestVideoVariant(variants: unknown[]): { url: string; ext: "mp4" | "m3u8" | null; protocol: "https" | "m3u8_native" | null; tbr: number | null } | null {
  const parsed = variants
    .map((v) => (isRecord(v) ? v : null))
    .filter((v): v is JsonRecord => Boolean(v))
    .map((v) => ({
      url: asString(v.url),
      contentType: asString(v.content_type),
      bitrate: asNumber(v.bitrate),
    }))
    .filter((v) => Boolean(v.url))

  const mp4 = parsed.filter((v) => v.contentType === "video/mp4" || (v.url && v.url.includes(".mp4")))
  mp4.sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))
  if (mp4[0]?.url) {
    return { url: mp4[0].url!, ext: "mp4", protocol: "https", tbr: mp4[0].bitrate ? Math.round(mp4[0].bitrate / 1000) : null }
  }

  const m3u8 = parsed.find((v) => (v.contentType || "").includes("mpegurl") || (v.url && v.url.includes(".m3u8")))
  if (m3u8?.url) {
    return { url: m3u8.url, ext: "m3u8", protocol: "m3u8_native", tbr: null }
  }

  return null
}

export async function fetchXTweetGraphql(tweetId: string): Promise<unknown> {
  const bearer = process.env.X_BEARER_TOKEN?.trim() || DEFAULT_X_BEARER
  const userAgent =
    process.env.X_USER_AGENT?.trim() ||
    process.env.YTDLP_USER_AGENT?.trim() ||
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

  const variables = {
    tweetId,
    withCommunity: false,
    includePromotedContent: false,
    withVoice: false,
  }

  const url = new URL(GRAPHQL_ENDPOINT)
  url.searchParams.set("variables", JSON.stringify(variables))
  url.searchParams.set("features", JSON.stringify(GRAPHQL_FEATURES))
  url.searchParams.set("fieldToggles", JSON.stringify(GRAPHQL_FIELD_TOGGLES))

  const attempt = async (forceRefreshGuest: boolean): Promise<Response> => {
    const guest = forceRefreshGuest ? await fetchGuestToken() : await getGuestToken()
    return fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${bearer}`,
        "x-guest-token": guest,
        "x-twitter-active-user": "yes",
        "x-twitter-client-language": "en",
        Referer: "https://x.com/",
        Origin: "https://x.com",
        "User-Agent": userAgent,
        Accept: "application/json",
      },
    })
  }

  let res = await attempt(false)
  if (res.status === 401 || res.status === 403) {
    res = await attempt(true)
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "")
    throw new AppError("X_GRAPHQL_FAILED", `X GraphQL failed (${res.status}): ${body.slice(0, 300)}`)
  }

  return res.json()
}

export function extractTweetFromXGraphql(raw: unknown): ExtractedXTweet {
  const resultRaw = getPath(raw, ["data", "tweetResult", "result"])
  if (!isRecord(resultRaw)) {
    throw new AppError("X_GRAPHQL_PARSE_FAILED", "Missing tweetResult.result in GraphQL response")
  }

  let result: JsonRecord = resultRaw
  const typename = asString(result.__typename)
  if (typename === "TweetWithVisibilityResults") {
    const inner = getPath(result, ["tweet"])
    if (isRecord(inner)) result = inner
  }

  if (isRecord(result.tombstone)) {
    const cause = asString(getPath(result, ["tombstone", "text", "text"])) ?? "Tweet unavailable"
    throw new AppError("X_TWEET_UNAVAILABLE", cause)
  }
  if (typename === "TweetUnavailable") {
    const reason = asString(result.reason) ?? "Tweet unavailable"
    throw new AppError("X_TWEET_UNAVAILABLE", reason)
  }

  const legacy = getPath(result, ["legacy"])
  const legacyRec = isRecord(legacy) ? legacy : {}

  const userLegacy = getPath(result, ["core", "user_results", "result", "legacy"])
  const userRec = isRecord(userLegacy) ? userLegacy : {}

  const text = (asString(legacyRec.full_text) ?? asString(legacyRec.text) ?? "").trim()

  const authorHandle = asString(userRec.screen_name) ?? null
  const authorName = asString(userRec.name) ?? null
  const authorAvatarRaw = asString(userRec.profile_image_url_https) ?? null
  const authorAvatar = authorAvatarRaw ? authorAvatarRaw.replace("_normal.", "_200x200.") : null

  const mediaRaw = getPath(legacyRec, ["extended_entities", "media"])
  const mediaList = Array.isArray(mediaRaw) ? mediaRaw : []

  const images: ExtractedXMediaImage[] = []
  let video: ExtractedXMediaVideo | null = null

  for (const m of mediaList) {
    if (!isRecord(m)) continue
    const type = asString(m.type)
    const mediaUrl = asString(m.media_url_https)
    const originalInfo = isRecord(m.original_info) ? m.original_info : null
    const width = originalInfo ? asNumber(originalInfo.width) : null
    const height = originalInfo ? asNumber(originalInfo.height) : null
    const alt = asString(m.ext_alt_text)

    if (type === "photo" && mediaUrl) {
      images.push({
        url: toOrigImageUrl(mediaUrl),
        width,
        height,
        alt,
      })
      continue
    }

    if ((type === "video" || type === "animated_gif") && !video) {
      const variantsRaw = getPath(m, ["video_info", "variants"])
      const variants = Array.isArray(variantsRaw) ? variantsRaw : []
      const picked = pickBestVideoVariant(variants)
      if (!picked) continue

      video = {
        bestUrl: picked.url,
        ext: picked.ext,
        protocol: picked.protocol,
        width,
        height,
        tbr: picked.tbr,
        thumbnailUrl: mediaUrl ? toOrigImageUrl(mediaUrl) : null,
      }
    }
  }

  // Extract conversation ID and quoted tweet
  const conversationId = asString(legacyRec.conversation_id_str) ?? null

  // Check for quoted tweet
  let quotedTweetUrl: string | null = null
  const quotedStatusResult = getPath(result, ["quoted_status_result", "result"])
  if (isRecord(quotedStatusResult)) {
    const quotedLegacy = getPath(quotedStatusResult, ["legacy"])
    if (isRecord(quotedLegacy)) {
      const quotedId = asString(quotedLegacy.id_str)
      const quotedUserResult = getPath(quotedStatusResult, ["core", "user_results", "result", "legacy"])
      const quotedHandle = isRecord(quotedUserResult) ? asString(quotedUserResult.screen_name) : null
      if (quotedId && quotedHandle) {
        quotedTweetUrl = `https://x.com/${quotedHandle}/status/${quotedId}`
      }
    }
  }

  return {
    authorHandle,
    authorName,
    authorAvatar,
    text,
    raw,
    images,
    video,
    isReply: !!asString(legacyRec.in_reply_to_status_id_str),
    inReplyToStatusId: asString(legacyRec.in_reply_to_status_id_str),
    conversationId,
    quotedTweetUrl
  }
}
