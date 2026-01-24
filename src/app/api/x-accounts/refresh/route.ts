import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { encryptToken, decryptToken } from "@/lib/crypto"
import { refreshAccessToken } from "@/lib/x-oauth"

// POST /api/x-accounts/refresh - Refresh token for an account
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { accountId } = body

        if (!accountId) {
            return NextResponse.json(
                { error: "accountId is required" },
                { status: 400 }
            )
        }

        // Get account with refresh token
        const account = await prisma.xAccount.findUnique({
            where: { id: accountId },
            select: {
                id: true,
                refreshToken: true,
            },
        })

        if (!account) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 }
            )
        }

        if (!account.refreshToken) {
            return NextResponse.json(
                { error: "No refresh token available" },
                { status: 400 }
            )
        }

        const clientId = process.env.X_CLIENT_ID
        const clientSecret = process.env.X_CLIENT_SECRET

        if (!clientId || !clientSecret) {
            return NextResponse.json(
                { error: "X OAuth not configured" },
                { status: 500 }
            )
        }

        // Decrypt refresh token
        const decryptedRefreshToken = decryptToken(account.refreshToken)

        // Refresh tokens
        const tokenResponse = await refreshAccessToken({
            refreshToken: decryptedRefreshToken,
            clientId,
            clientSecret,
        })

        // Calculate new expiry
        const tokenExpiry = new Date(Date.now() + tokenResponse.expires_in * 1000)

        // Encrypt new tokens
        const encryptedAccessToken = encryptToken(tokenResponse.access_token)
        const encryptedRefreshToken = tokenResponse.refresh_token
            ? encryptToken(tokenResponse.refresh_token)
            : account.refreshToken // Keep old if not provided

        // Update account
        const updated = await prisma.xAccount.update({
            where: { id: accountId },
            data: {
                accessToken: encryptedAccessToken,
                refreshToken: encryptedRefreshToken,
                tokenExpiry,
                lastError: null,
            },
            select: {
                id: true,
                xUsername: true,
                tokenExpiry: true,
            },
        })

        return NextResponse.json({
            success: true,
            account: updated,
        })
    } catch (error) {
        console.error("Failed to refresh token:", error)

        // Update account with error
        const body = await request.clone().json().catch(() => ({}))
        if (body.accountId) {
            await prisma.xAccount.update({
                where: { id: body.accountId },
                data: {
                    lastError: error instanceof Error ? error.message : "Token refresh failed",
                },
            }).catch(() => {})
        }

        return NextResponse.json(
            { error: "Failed to refresh token" },
            { status: 500 }
        )
    }
}
