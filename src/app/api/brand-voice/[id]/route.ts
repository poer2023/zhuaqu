import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/brand-voice/[id] - Get a single brand voice
export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        const brandVoice = await prisma.brandVoice.findUnique({
            where: { id },
        })

        if (!brandVoice) {
            return NextResponse.json(
                { error: "Brand voice not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ brandVoice })
    } catch (error) {
        console.error("Failed to fetch brand voice:", error)
        return NextResponse.json(
            { error: "Failed to fetch brand voice" },
            { status: 500 }
        )
    }
}

// PATCH /api/brand-voice/[id] - Update a brand voice
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const body = await request.json()
        const { name, description, sampleTweets, styleProfile, systemPrompt, isDefault, isActive } = body

        // Get the current brand voice to find workspaceId
        const current = await prisma.brandVoice.findUnique({
            where: { id },
            select: { workspaceId: true },
        })

        if (!current) {
            return NextResponse.json(
                { error: "Brand voice not found" },
                { status: 404 }
            )
        }

        // If setting as default, unset other defaults first
        if (isDefault === true) {
            await prisma.brandVoice.updateMany({
                where: {
                    workspaceId: current.workspaceId,
                    isDefault: true,
                    id: { not: id },
                },
                data: { isDefault: false },
            })
        }

        const brandVoice = await prisma.brandVoice.update({
            where: { id },
            data: {
                ...(name !== undefined && { name }),
                ...(description !== undefined && { description }),
                ...(sampleTweets !== undefined && { sampleTweets }),
                ...(styleProfile !== undefined && { styleProfile }),
                ...(systemPrompt !== undefined && { systemPrompt }),
                ...(isDefault !== undefined && { isDefault }),
                ...(isActive !== undefined && { isActive }),
            },
        })

        return NextResponse.json({ brandVoice })
    } catch (error) {
        console.error("Failed to update brand voice:", error)
        return NextResponse.json(
            { error: "Failed to update brand voice" },
            { status: 500 }
        )
    }
}

// DELETE /api/brand-voice/[id] - Soft delete a brand voice
export async function DELETE(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params

        await prisma.brandVoice.update({
            where: { id },
            data: { isActive: false },
        })

        return NextResponse.json({ success: true })
    } catch (error) {
        console.error("Failed to delete brand voice:", error)
        return NextResponse.json(
            { error: "Failed to delete brand voice" },
            { status: 500 }
        )
    }
}
