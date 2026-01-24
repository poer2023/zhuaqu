"use client"

import { useState } from "react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { AlertTriangle, Loader2 } from "lucide-react"

interface ComplianceConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    itemCount: number
    isLoading?: boolean
    onConfirm: () => void
}

const COMPLIANCE_ITEMS = [
    {
        id: "tos",
        label: "I confirm this content does not violate X/Twitter Terms of Service",
        description: "No spam, harassment, hate speech, or misleading content",
    },
    {
        id: "accuracy",
        label: "I have verified the accuracy of the content",
        description: "Facts, quotes, and attributions have been checked",
    },
    {
        id: "attribution",
        label: "Original sources are properly attributed where required",
        description: "Credit given to original authors when appropriate",
    },
]

export function ComplianceConfirmDialog({
    open,
    onOpenChange,
    itemCount,
    isLoading = false,
    onConfirm,
}: ComplianceConfirmDialogProps) {
    const [confirmed, setConfirmed] = useState<Record<string, boolean>>({})

    const allConfirmed = COMPLIANCE_ITEMS.every((item) => confirmed[item.id])

    const handleConfirmChange = (id: string, checked: boolean) => {
        setConfirmed((prev) => ({ ...prev, [id]: checked }))
    }

    const handleConfirm = () => {
        if (allConfirmed) {
            onConfirm()
        }
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            setConfirmed({})
        }
        onOpenChange(newOpen)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Confirm Publishing
                    </DialogTitle>
                    <DialogDescription>
                        You are about to publish {itemCount} item{itemCount > 1 ? "s" : ""}.
                        Please confirm the following before proceeding.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {COMPLIANCE_ITEMS.map((item) => (
                        <div
                            key={item.id}
                            className="flex items-start gap-3 p-3 rounded-lg border bg-muted/20"
                        >
                            <Checkbox
                                id={item.id}
                                checked={confirmed[item.id] || false}
                                onCheckedChange={(checked) =>
                                    handleConfirmChange(item.id, !!checked)
                                }
                                className="mt-0.5"
                            />
                            <div className="flex-1">
                                <label
                                    htmlFor={item.id}
                                    className="text-sm font-medium cursor-pointer"
                                >
                                    {item.label}
                                </label>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <DialogFooter>
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isLoading}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirm}
                        disabled={!allConfirmed || isLoading}
                    >
                        {isLoading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Publishing...
                            </>
                        ) : (
                            `Publish ${itemCount} Item${itemCount > 1 ? "s" : ""}`
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
