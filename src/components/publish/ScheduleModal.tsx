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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Calendar, Clock, Loader2 } from "lucide-react"
import { format, addHours, setHours, setMinutes } from "date-fns"

interface ScheduleModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    itemCount: number
    isLoading?: boolean
    onPublishNow: () => void
    onSchedule: (scheduledAt: Date) => void
}

export function ScheduleModal({
    open,
    onOpenChange,
    itemCount,
    isLoading = false,
    onPublishNow,
    onSchedule,
}: ScheduleModalProps) {
    // Default to 1 hour from now, rounded to next 15 min
    const getDefaultDate = () => {
        const future = addHours(new Date(), 1)
        const minutes = Math.ceil(future.getMinutes() / 15) * 15
        return setMinutes(setHours(future, future.getHours()), minutes % 60)
    }

    const [selectedDate, setSelectedDate] = useState<string>(
        format(getDefaultDate(), "yyyy-MM-dd")
    )
    const [selectedTime, setSelectedTime] = useState<string>(
        format(getDefaultDate(), "HH:mm")
    )

    const handleSchedule = () => {
        const [hours, minutes] = selectedTime.split(":").map(Number)
        const date = new Date(selectedDate)
        date.setHours(hours, minutes, 0, 0)

        if (date <= new Date()) {
            alert("Scheduled time must be in the future")
            return
        }

        onSchedule(date)
    }

    const handleOpenChange = (newOpen: boolean) => {
        if (!newOpen) {
            // Reset to defaults when closing
            const def = getDefaultDate()
            setSelectedDate(format(def, "yyyy-MM-dd"))
            setSelectedTime(format(def, "HH:mm"))
        }
        onOpenChange(newOpen)
    }

    const minDate = format(new Date(), "yyyy-MM-dd")

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Schedule Publishing
                    </DialogTitle>
                    <DialogDescription>
                        Choose when to publish {itemCount} item{itemCount > 1 ? "s" : ""}.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="date" className="text-sm font-medium">
                                Date
                            </Label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="date"
                                    type="date"
                                    min={minDate}
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="time" className="text-sm font-medium">
                                Time
                            </Label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    id="time"
                                    type="time"
                                    value={selectedTime}
                                    onChange={(e) => setSelectedTime(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="rounded-lg border bg-muted/20 p-3">
                        <p className="text-sm text-muted-foreground">
                            Scheduled for:{" "}
                            <span className="font-medium text-foreground">
                                {format(
                                    new Date(`${selectedDate}T${selectedTime}`),
                                    "PPP 'at' p"
                                )}
                            </span>
                        </p>
                    </div>
                </div>

                <DialogFooter className="flex-col sm:flex-row gap-2">
                    <Button
                        variant="outline"
                        onClick={() => handleOpenChange(false)}
                        disabled={isLoading}
                        className="sm:flex-1"
                    >
                        Cancel
                    </Button>
                    <Button
                        variant="secondary"
                        onClick={onPublishNow}
                        disabled={isLoading}
                        className="sm:flex-1"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : null}
                        Publish Now
                    </Button>
                    <Button
                        onClick={handleSchedule}
                        disabled={isLoading}
                        className="sm:flex-1"
                    >
                        {isLoading ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                            <Clock className="h-4 w-4 mr-2" />
                        )}
                        Schedule
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
