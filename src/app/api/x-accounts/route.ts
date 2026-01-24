import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"
import { prisma } from "@/lib/prisma"
import { decryptToken } from "@/lib/crypto"
import {
    generatePKCEChallenge,
    generateState,
    buildAuthorizationUrl,
} from "@/lib/x-oauth"

// GET /api/x-accounts - List all X accounts for a workspace
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const workspaceId = searchParams.get("workspaceId")

        if (!workspaceId) {
            return NextResponse.json(
                { error: "workspaceId is required" },
                { status: 400 }
            )
        }

        const accounts = await prisma.xAccount.findMany({
            where: { workspaceId },
            orderBy: [
                { isDefault: "desc" },
                { createdAt: "desc" },
            ],
            select: {
                id: true,
                xUserId: true,
                xUsername: true,
                xDisplayName: true,
                xAvatar: true,
                isActive: true,
                isDefault: true,
                tokenExpiry: true,
                lastUsedAt: true,
                lastError: true,
                createdAt: true,
            },
        })

        // Add token status for each account
        const accountsWithStatus = accounts.map((account) => ({
            ...account,
            tokenStatus: getTokenStatus(account.tokenExpiry),
        }))

        return NextResponse.json({ accounts: accountsWithStatus })
    } catch (error) {
        console.error("Failed to fetch X accounts:", error)
        return NextResponse.json(
            { error: "Failed to fetch X accounts" },
            { status: 500 }
        )
    }
}

// POST /api/x-accounts - Initiate OAuth flow
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId } = body

        if (!workspaceId) {
            return NextResponse.json(
                { error: "workspaceId is required" },
                { status: 400 }
            )
        }

        const clientId = process.env.X_CLIENT_ID
        const redirectUri = process.env.NEXT_PUBLIC_X_CALLBACK_URL

        if (!clientId || !redirectUri) {
            return NextResponse.json(
                { error: "X OAuth not configured" },
                { status: 500 }
            )
        }

        // Generate PKCE challenge
        const { codeVerifier, codeChallenge } = generatePKCEChallenge()

        // Generate state with workspaceId
        const state = generateState(workspaceId)

        // Store in HttpOnly cookie (expires in 10 minutes)
        const cookieStore = await cookies()
        cookieStore.set("x_oauth_verifier", codeVerifier, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600, // 10 minutes
            path: "/",
        })
        cookieStore.set("x_oauth_state", state, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "lax",
            maxAge: 600,
            path: "/",
        })

        // Build authorization URL
        const authUrl = buildAuthorizationUrl({
            clientId,
            redirectUri,
            codeChallenge,
            state,
        })

        return NextResponse.json({ authUrl })
    } catch (error) {
        console.error("Failed to initiate X OAuth:", error)
        return NextResponse.json(
            { error: "Failed to initiate OAuth" },
            { status: 500 }
        )
    }
}

function getTokenStatus(tokenExpiry: Date | null): "valid" | "expiring" | "expired" | "unknown" {
    if (!tokenExpiry) return "unknown"

    const now = new Date()
    const expiryTime = new Date(tokenExpiry).getTime()
    const nowTime = now.getTime()

    if (expiryTime < nowTime) return "expired"
    if (expiryTime - nowTime < 24 * 60 * 60 * 1000) return "expiring" // Within 24 hours
    return "valid"
}
