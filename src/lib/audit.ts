import prisma from "@/lib/prisma"
import { Prisma, AuditAction } from "@prisma/client"

export interface AuditLogEntry {
    workspaceId: string
    contentItemId?: string | null
    action: AuditAction
    details?: Prisma.InputJsonValue
    actor?: string
}

/**
 * Create a single audit log entry
 */
export async function createAuditLog(
    entry: AuditLogEntry,
    tx?: Prisma.TransactionClient
): Promise<void> {
    const client = tx ?? prisma
    await client.auditLog.create({
        data: {
            workspaceId: entry.workspaceId,
            contentItemId: entry.contentItemId ?? null,
            action: entry.action,
            details: entry.details ?? {},
            actor: entry.actor ?? "system",
        },
    })
}

/**
 * Create multiple audit log entries in batch
 */
export async function createBatchAuditLogs(
    entries: AuditLogEntry[],
    tx?: Prisma.TransactionClient
): Promise<void> {
    if (entries.length === 0) return

    const client = tx ?? prisma
    await client.auditLog.createMany({
        data: entries.map((entry) => ({
            workspaceId: entry.workspaceId,
            contentItemId: entry.contentItemId ?? null,
            action: entry.action,
            details: entry.details ?? {},
            actor: entry.actor ?? "system",
        })),
    })
}

/**
 * Helper to create audit entries for batch item operations
 */
export function createBatchItemAuditEntries(
    workspaceId: string,
    itemIds: string[],
    action: AuditAction,
    details: Prisma.InputJsonValue,
    actor = "owner"
): AuditLogEntry[] {
    return itemIds.map((contentItemId) => ({
        workspaceId,
        contentItemId,
        action,
        details,
        actor,
    }))
}
