import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { scoreTweet } from "@/lib/tweetScoring"

// POST /api/score - Score tweet content
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const {
            text,
            originalText,
            language = "zh",
            contentItemId,
            rewriteVersionId,
            save = false,
        } = body

        if (!text) {
            return NextResponse.json(
                { error: "text is required" },
                { status: 400 }
            )
        }

        // Calculate score
        const scoreResult = scoreTweet(text, {
            originalText,
            language,
        })

        // Save to database if requested
        if (save && (contentItemId || rewriteVersionId)) {
            // Check if score already exists
            const existing = rewriteVersionId
                ? await prisma.contentScore.findUnique({
                      where: { rewriteVersionId },
                  })
                : null

            if (existing) {
                // Update existing score
                await prisma.contentScore.update({
                    where: { id: existing.id },
                    data: {
                        hookScore: scoreResult.hookScore,
                        clarityScore: scoreResult.clarityScore,
                        engagementScore: scoreResult.engagementScore,
                        originalityScore: scoreResult.originalityScore,
                        overallScore: scoreResult.overallScore,
                        analysis: scoreResult.analysis,
                        suggestions: scoreResult.suggestions,
                        warnings: scoreResult.warnings,
                        scoredAt: new Date(),
                    },
                })
            } else {
                // Create new score
                await prisma.contentScore.create({
                    data: {
                        contentItemId,
                        rewriteVersionId,
                        hookScore: scoreResult.hookScore,
                        clarityScore: scoreResult.clarityScore,
                        engagementScore: scoreResult.engagementScore,
                        originalityScore: scoreResult.originalityScore,
                        overallScore: scoreResult.overallScore,
                        analysis: scoreResult.analysis,
                        suggestions: scoreResult.suggestions,
                        warnings: scoreResult.warnings,
                    },
                })
            }
        }

        return NextResponse.json({ score: scoreResult })
    } catch (error) {
        console.error("Failed to score content:", error)
        return NextResponse.json(
            { error: "Failed to score content" },
            { status: 500 }
        )
    }
}

// GET /api/score - Get saved score
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url)
        const rewriteVersionId = searchParams.get("rewriteVersionId")
        const contentItemId = searchParams.get("contentItemId")

        if (!rewriteVersionId && !contentItemId) {
            return NextResponse.json(
                { error: "rewriteVersionId or contentItemId is required" },
                { status: 400 }
            )
        }

        const score = await prisma.contentScore.findFirst({
            where: rewriteVersionId
                ? { rewriteVersionId }
                : { contentItemId },
        })

        if (!score) {
            return NextResponse.json(
                { error: "Score not found" },
                { status: 404 }
            )
        }

        return NextResponse.json({ score })
    } catch (error) {
        console.error("Failed to fetch score:", error)
        return NextResponse.json(
            { error: "Failed to fetch score" },
            { status: 500 }
        )
    }
}
