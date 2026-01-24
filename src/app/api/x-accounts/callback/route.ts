import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { encryptToken } from "@/lib/crypto"
import {
    parseState,
    exchangeCodeForToken,
    fetchUserInfo,
} from "@/lib/x-oauth"

// GET /api/x-accounts/callback - OAuth callback handler
export async function GET(request: NextRequest) {
    const settingsUrl = new URL("/settings/x-accounts", request.url)

    try {
        const { searchParams } = new URL(request.url)
        const code = searchParams.get("code")
        const state = searchParams.get("state")
        const error = searchParams.get("error")

        // Handle OAuth errors
        if (error) {
            console.error("X OAuth error:", error)
            settingsUrl.searchParams.set("error", error)
            return NextResponse.redirect(settingsUrl)
        }

        if (!code || !state) {
            settingsUrl.searchParams.set("error", "missing_params")
            return NextResponse.redirect(settingsUrl)
        }

        // Verify state and get stored values
        const cookieStore = await cookies()
        const storedState = cookieStore.get("x_oauth_state")?.value
        const codeVerifier = cookieStore.get("x_oauth_verifier")?.value

        if (!storedState || !codeVerifier) {
            settingsUrl.searchParams.set("error", "session_expired")
            return NextResponse.redirect(settingsUrl)
        }

        if (state !== storedState) {
            settingsUrl.searchParams.set("error", "invalid_state")
            return NextResponse.redirect(settingsUrl)
        }

        // Parse state to get workspaceId
        const parsedState = parseState(state)
        if (!parsedState) {
            settingsUrl.searchParams.set("error", "invalid_state")
            return NextResponse.redirect(settingsUrl)
        }

        const { workspaceId } = parsedState

        // Get OAuth config
        const clientId = process.env.X_CLIENT_ID
        const clientSecret = process.env.X_CLIENT_SECRET
        const redirectUri = process.env.NEXT_PUBLIC_X_CALLBACK_URL

        if (!clientId || !clientSecret || !redirectUri) {
            settingsUrl.searchParams.set("error", "config_error")
            return NextResponse.redirect(settingsUrl)
        }

        // Exchange code for tokens
        const tokenResponse = await exchangeCodeForToken({
            code,
            codeVerifier,
            clientId,
            clientSecret,
            redirectUri,
        })

        // Fetch user info
        const userInfo = await fetchUserInfo(tokenResponse.access_token)

        // Calculate token expiry
        const tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000)

        // Encrypt tokens
        const encryptedAccessToken = encryptToken(tokenResponse.access_token)
        const encryptedRefreshToken = tokenResponse.refresh_token
            ? encryptToken(tokenResponse.refresh_token)
            : null

        // Upsert X account (update if same X user already linked)
        await prisma.xAccount.upsert({
            where: {
                workspaceId_xUserId: {
                    workspaceId,
                    xUserId: userInfo.id,
                },
            },
            create: {
                workspaceId,
                xUserId: userInfo.id,
                xUsername: userInfo.username,
                xDisplayName: userInfo.name,
                xAvatar: userInfo.profile_image_url || null,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiry,
                isActive: true,
                isDefault: await isFirstAccount(workspaceId),
            },
            update: {
                xUsername: userInfo.username,
                xDisplayName: userInfo.name,
                xAvatar: userInfo.profile_image_url || null,
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiry,
                isActive: true,
                lastError: null,
            },
        })

        // Clear OAuth cookies
        cookieStore.delete("x_oauth_state")
        cookieStore.delete("x_oauth_verifier")

        // Redirect with success
        settingsUrl.searchParams.set("success", "true")
        return NextResponse.redirect(settingsUrl)
    } catch (error) {
        console.error("X OAuth callback error:", error)
        settingsUrl.searchParams.set("error", "callback_failed")
        return NextResponse.redirect(settingsUrl)
    }
}

async function isFirstAccount(workspaceId: string): Promise<boolean> {
    const count = await prisma.xAccount.count({
        where: { workspaceId },
    })
    return count === 0
}
