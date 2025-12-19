"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"

interface UseBatchActionsOptions {
    workspaceId: string | null
    items: Array<{ id: string; approvedRewriteVersionId?: string }>
    onRefresh: () => void
}

export function useBatchActions(options: UseBatchActionsOptions) {
    const { workspaceId, items, onRefresh } = options
    const router = useRouter()

    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
    const [isMoving, setIsMoving] = useState(false)
    const [isBatchActionLoading, setIsBatchActionLoading] = useState(false)
    const [moveDialogOpen, setMoveDialogOpen] = useState(false)
    const [moveTargetPoolId, setMoveTargetPoolId] = useState("")
    const [publishDialogOpen, setPublishDialogOpen] = useState(false)
    const [publishComplianceConfirmed, setPublishComplianceConfirmed] = useState(false)

    // 选择操作
    const toggleItem = useCallback((itemId: string) => {
        setSelectedItems((prev) => {
            const next = new Set(prev)
            if (next.has(itemId)) {
                next.delete(itemId)
            } else {
                next.add(itemId)
            }
            return next
        })
    }, [])

    const selectAll = useCallback(() => {
        setSelectedItems(new Set(items.map((i) => i.id)))
    }, [items])

    const clearSelection = useCallback(() => {
        setSelectedItems(new Set())
    }, [])

    // 批量移动
    const openMoveDialog = useCallback(() => {
        setMoveTargetPoolId("")
        setMoveDialogOpen(true)
    }, [])

    const confirmMove = useCallback(async () => {
        if (!moveTargetPoolId || selectedItems.size === 0) return
        setIsMoving(true)
        try {
            await fetch("/api/pools/items", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "move",
                    itemIds: Array.from(selectedItems),
                    data: { poolId: moveTargetPoolId },
                }),
            })
            clearSelection()
            setMoveDialogOpen(false)
            onRefresh()
        } catch (error) {
            console.error("Failed to move items:", error)
        } finally {
            setIsMoving(false)
        }
    }, [moveTargetPoolId, selectedItems, clearSelection, onRefresh])

    // 批量改写
    const handleRewriteSelected = useCallback(async () => {
        if (selectedItems.size === 0 || !workspaceId) return
        setIsBatchActionLoading(true)
        try {
            const res = await fetch("/api/rewrite/batches", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    itemIds: Array.from(selectedItems),
                    name: `Batch Rewrite ${new Date().toLocaleDateString()}`,
                }),
            })
            if (res.ok) {
                const data = await res.json()
                if (data.batch?.id) {
                    router.push(`/rewrite?batchId=${data.batch.id}`)
                }
            }
        } catch (error) {
            console.error("Failed to create rewrite batch:", error)
        } finally {
            setIsBatchActionLoading(false)
        }
    }, [selectedItems, workspaceId, router])

    // 批量发布
    const openPublishDialog = useCallback(() => {
        const itemsToPublish = items.filter(
            (i) => selectedItems.has(i.id) && i.approvedRewriteVersionId
        )
        if (itemsToPublish.length === 0) {
            alert("选中的条目中没有已通过改写内容的内容 (Approved Rewrite)。")
            return
        }
        setPublishComplianceConfirmed(false)
        setPublishDialogOpen(true)
    }, [items, selectedItems])

    const confirmBatchPublish = useCallback(async () => {
        if (!publishComplianceConfirmed || !workspaceId) return
        const itemsToPublish = items.filter(
            (i) => selectedItems.has(i.id) && i.approvedRewriteVersionId
        )

        setIsBatchActionLoading(true)
        setPublishDialogOpen(false)
        try {
            const rewriteVersionIds = itemsToPublish.map((i) => i.approvedRewriteVersionId!)
            await fetch("/api/publish/jobs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    workspaceId,
                    rewriteVersionIds,
                    mode: "single",
                    complianceConfirmed: true,
                }),
            })
            onRefresh()
            clearSelection()
            router.push("/publish")
        } catch (error) {
            console.error("Failed to batch publish:", error)
        } finally {
            setIsBatchActionLoading(false)
        }
    }, [
        publishComplianceConfirmed,
        workspaceId,
        items,
        selectedItems,
        onRefresh,
        clearSelection,
        router,
    ])

    return {
        // 状态
        selectedItems,
        isMoving,
        isBatchActionLoading,
        moveDialogOpen,
        moveTargetPoolId,
        publishDialogOpen,
        publishComplianceConfirmed,

        // 选择操作
        toggleItem,
        selectAll,
        clearSelection,

        // 移动操作
        openMoveDialog,
        setMoveDialogOpen,
        setMoveTargetPoolId,
        confirmMove,

        // 改写操作
        handleRewriteSelected,

        // 发布操作
        openPublishDialog,
        setPublishDialogOpen,
        setPublishComplianceConfirmed,
        confirmBatchPublish,
    }
}
