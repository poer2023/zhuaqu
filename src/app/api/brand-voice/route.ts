import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

// GET /api/brand-voice - List all brand voices for a workspace
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

        const brandVoices = await prisma.brandVoice.findMany({
            where: {
                workspaceId,
                isActive: true,
            },
            orderBy: [
                { isDefault: "desc" },
                { createdAt: "desc" },
            ],
        })

        return NextResponse.json({ brandVoices })
    } catch (error) {
        console.error("Failed to fetch brand voices:", error)
        return NextResponse.json(
            { error: "Failed to fetch brand voices" },
            { status: 500 }
        )
    }
}

// POST /api/brand-voice - Create a new brand voice
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { workspaceId, name, description, sampleTweets, isDefault } = body

        if (!workspaceId || !name) {
            return NextResponse.json(
                { error: "workspaceId and name are required" },
                { status: 400 }
            )
        }

        // If setting as default, unset other defaults first
        if (isDefault) {
            await prisma.brandVoice.updateMany({
                where: { workspaceId, isDefault: true },
                data: { isDefault: false },
            })
        }

        const brandVoice = await prisma.brandVoice.create({
            data: {
                workspaceId,
                name,
                description: description || null,
                sampleTweets: sampleTweets || [],
                isDefault: isDefault || false,
            },
        })

        return NextResponse.json({ brandVoice }, { status: 201 })
    } catch (error) {
        console.error("Failed to create brand voice:", error)
        return NextResponse.json(
            { error: "Failed to create brand voice" },
            { status: 500 }
        )
    }
}
