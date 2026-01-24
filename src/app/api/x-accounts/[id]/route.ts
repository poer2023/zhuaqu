import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// PATCH /api/x-accounts/[id] - Update account settings
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { isDefault, isActive } = body

        // Get current account to find workspaceId
        const account = await prisma.xAccount.findUnique({
            where: { id },
            select: { workspaceId: true },
        })

        if (!account) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 }
            )
        }

        // If setting as default, unset other defaults first
        if (isDefault === true) {
            await prisma.xAccount.updateMany({
                where: {
                    workspaceId: account.workspaceId,
                    isDefault: true,
                },
                data: { isDefault: false },
            })
        }

        // Update the account
        const updated = await prisma.xAccount.update({
            where: { id },
            data: {
                ...(isDefault !== undefined && { isDefault }),
                ...(isActive !== undefined && { isActive }),
            },
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
            },
        })

        return NextResponse.json({ account: updated })
    } catch (error) {
        console.error("Failed to update X account:", error)
        return NextResponse.json(
            { error: "Failed to update account" },
            { status: 500 }
        )
    }
}

// DELETE /api/x-accounts/[id] - Remove account
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        // Get account to check if it was default
        const account = await prisma.xAccount.findUnique({
            where: { id },
            select: { workspaceId: true, isDefault: true },
        })

        if (!account) {
            return NextResponse.json(
                { error: "Account not found" },
                { status: 404 }
            )
        }

        // Delete the account
        await prisma.xAccount.delete({
            where: { id },
        })

        // If deleted account was default, set another as default
        if (account.isDefault) {
            const nextAccount = await prisma.xAccount.findFirst({
                where: { workspaceId: account.workspaceId },
                orderBy: { createdAt: "asc" },
            })

            if (nextAccount) {
                await prisma.xAccount.update({
                    where: { id: nextAccount.id },
                    data: { isDefault: true },
                })
            }
        }

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete X account:", error)
        return NextResponse.json(
            { error: "Failed to delete account" },
            { status: 500 }
        )
    }
}
