import crypto from "crypto"

const X_AUTH_URL = "https://twitter.com/i/oauth2/authorize"
const X_TOKEN_URL = "https://api.twitter.com/2/oauth2/token"
const X_USER_URL = "https://api.twitter.com/2/users/me"

export interface PKCEChallenge {
    codeVerifier: string
    codeChallenge: string
}

export interface TokenResponse {
    access_token: string
    refresh_token?: string
    expires_in: number
    token_type: string
    scope: string
}

export interface XUserInfo {
    id: string
    username: string
    name: string
    profile_image_url?: string
}

/**
 * Generate PKCE code_verifier and code_challenge
 */
export function generatePKCEChallenge(): PKCEChallenge {
    // Generate 32 bytes random, base64url encode (43 chars)
    const codeVerifier = crypto.randomBytes(32)
        .toString("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")

    // SHA256 hash, base64url encode
    const codeChallenge = crypto
        .createHash("sha256")
        .update(codeVerifier)
        .digest("base64")
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "")

    return { codeVerifier, codeChallenge }
}

/**
 * Generate a random state parameter
 */
export function generateState(workspaceId: string): string {
    const random = crypto.randomBytes(16).toString("hex")
    // Encode workspaceId in state for callback
    return `${random}:${Buffer.from(workspaceId).toString("base64url")}`
}

/**
 * Parse state to extract workspaceId
 */
export function parseState(state: string): { random: string; workspaceId: string } | null {
    const parts = state.split(":")
    if (parts.length !== 2) return null

    try {
        const workspaceId = Buffer.from(parts[1], "base64url").toString("utf8")
        return { random: parts[0], workspaceId }
    } catch {
        return null
    }
}

/**
 * Build X OAuth 2.0 authorization URL
 */
export function buildAuthorizationUrl(params: {
    clientId: string
    redirectUri: string
    codeChallenge: string
    state: string
    scopes?: string[]
}): string {
    const { clientId, redirectUri, codeChallenge, state, scopes = ["tweet.read", "tweet.write", "users.read", "offline.access"] } = params

    const url = new URL(X_AUTH_URL)
    url.searchParams.set("response_type", "code")
    url.searchParams.set("client_id", clientId)
    url.searchParams.set("redirect_uri", redirectUri)
    url.searchParams.set("scope", scopes.join(" "))
    url.searchParams.set("state", state)
    url.searchParams.set("code_challenge", codeChallenge)
    url.searchParams.set("code_challenge_method", "S256")

    return url.toString()
}

/**
 * Exchange authorization code for tokens
 */
export async function exchangeCodeForToken(params: {
    code: string
    codeVerifier: string
    clientId: string
    clientSecret: string
    redirectUri: string
}): Promise<TokenResponse> {
    const { code, codeVerifier, clientId, clientSecret, redirectUri } = params

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

    const body = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
    })

    const response = await fetch(X_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`,
        },
        body: body.toString(),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token exchange failed: ${error}`)
    }

    return response.json()
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(params: {
    refreshToken: string
    clientId: string
    clientSecret: string
}): Promise<TokenResponse> {
    const { refreshToken, clientId, clientSecret } = params

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64")

    const body = new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
    })

    const response = await fetch(X_TOKEN_URL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`,
        },
        body: body.toString(),
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Token refresh failed: ${error}`)
    }

    return response.json()
}

/**
 * Fetch user info from X API
 */
export async function fetchUserInfo(accessToken: string): Promise<XUserInfo> {
    const response = await fetch(`${X_USER_URL}?user.fields=profile_image_url`, {
        headers: {
            "Authorization": `Bearer ${accessToken}`,
        },
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error(`Failed to fetch user info: ${error}`)
    }

    const data = await response.json()
    return data.data as XUserInfo
}
