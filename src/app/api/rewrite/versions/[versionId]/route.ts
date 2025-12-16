import { NextRequest, NextResponse } from "next/server"
import prisma from "@/lib/prisma"

// PATCH /api/rewrite/versions/[versionId] - 更新改写版本（审阅）
export async function PATCH(
    request: NextRequest,
    { params }: { params: Promise<{ versionId: string }> }
) {
    try {
        const { versionId } = await params
        const body = await request.json()
        const { action, output, reviewNotes } = body

        const version = await prisma.rewriteVersion.findUnique({
            where: { id: versionId },
            include: { contentItem: true }
        })

        if (!version) {
            return NextResponse.json(
                { error: "Version not found" },
                { status: 404 }
            )
        }

        let newStatus = version.status
        let updateData: Record<string, unknown> = {}

        switch (action) {
            case "approve":
                newStatus = "APPROVED"
                updateData = {
                    status: "APPROVED",
                    reviewedAt: new Date(),
                    reviewNotes,
                }
                // 同时更新内容项状态
                await prisma.contentItem.update({
                    where: { id: version.contentItemId },
                    data: { rewriteStatus: "APPROVED" }
                })

                // 记录审计日志
                await prisma.auditLog.create({
                    data: {
                        workspaceId: version.contentItem.workspaceId,
                        contentItemId: version.contentItemId,
                        action: "REWRITE_APPROVED",
                        details: { versionId, version: version.version },
                        actor: "owner",
                    }
                })
                break

            case "reject":
                newStatus = "REJECTED"
                updateData = {
                    status: "REJECTED",
                    reviewedAt: new Date(),
                    reviewNotes,
                }
                await prisma.contentItem.update({
                    where: { id: version.contentItemId },
                    data: { rewriteStatus: "REJECTED" }
                })

                await prisma.auditLog.create({
                    data: {
                        workspaceId: version.contentItem.workspaceId,
                        contentItemId: version.contentItemId,
                        action: "REWRITE_REJECTED",
                        details: { versionId, version: version.version, reason: reviewNotes },
                        actor: "owner",
                    }
                })
                break

            case "rework":
                newStatus = "REWORK"
                updateData = {
                    status: "REWORK",
                    reviewedAt: new Date(),
                    reviewNotes,
                }
                await prisma.contentItem.update({
                    where: { id: version.contentItemId },
                    data: { rewriteStatus: "REWORK" }
                })

                await prisma.auditLog.create({
                    data: {
                        workspaceId: version.contentItem.workspaceId,
                        contentItemId: version.contentItemId,
                        action: "REWRITE_REWORK",
                        details: { versionId, version: version.version, reason: reviewNotes },
                        actor: "owner",
                    }
                })
                break

            case "edit":
                // 手动编辑内容
                if (output) {
                    updateData = {
                        output,
                        charCount: typeof output === "object" && output.text ? output.text.length : 0,
                    }
                }
                break

            default:
                return NextResponse.json(
                    { error: "Unknown action" },
                    { status: 400 }
                )
        }

        const updatedVersion = await prisma.rewriteVersion.update({
            where: { id: versionId },
            data: updateData
        })

        return NextResponse.json({ version: updatedVersion })
    } catch (error) {
        console.error("Failed to update version:", error)
        return NextResponse.json(
            { error: "Failed to update version" },
            { status: 500 }
        )
    }
}
