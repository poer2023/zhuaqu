import { cn } from "@/lib/utils"

interface PageShellProps {
    children: React.ReactNode
    title?: string
    description?: React.ReactNode
    headerAction?: React.ReactNode
    className?: string
    variant?: "default" | "full" | "focus"
}

export function PageShell({
    children,
    title,
    description,
    headerAction,
    className,
    variant = "default"
}: PageShellProps) {
    // Focus variant: Centered content, cleaner
    if (variant === "focus") {
        return (
            <div className={cn("max-w-4xl mx-auto pt-12 pb-16 animate-fade-in px-4", className)}>
                <div className="mb-10 text-center space-y-2">
                    {title && <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>}
                    {description && <div className="text-muted-foreground max-w-2xl mx-auto">{description}</div>}
                </div>
                {children}
            </div>
        )
    }

    // Full variant: For immersive editors or full-width tables
    if (variant === "full") {
        return (
            <div className={cn("flex flex-col h-full flex-1 min-h-0 animate-fade-in", className)}>
                {(title || headerAction) && (
                    <div className="flex items-center justify-between px-6 py-4 border-b shrink-0 bg-background/50 backdrop-blur-sm">
                        <div>
                            {title && <h1 className="text-lg font-semibold tracking-tight">{title}</h1>}
                            {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
                        </div>
                        {headerAction && <div className="flex items-center gap-2">{headerAction}</div>}
                    </div>
                )}
                <div className="flex-1 overflow-hidden min-h-0 relative">
                    {children}
                </div>
            </div>
        )
    }

    // Default variant: Standard page with max-width
    return (
        <div className={cn("max-w-6xl mx-auto pt-6 pb-12 animate-fade-in px-6", className)}>
            {(title || headerAction) && (
                <div className="flex flex-col sm:flex-row sm:items-end justify-between border-b pb-5 mb-8 gap-4">
                    <div className="space-y-1">
                        {title && <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>}
                        {description && <div className="text-sm text-muted-foreground">{description}</div>}
                    </div>
                    {headerAction && <div className="flex items-center gap-2 shrink-0">{headerAction}</div>}
                </div>
            )}
            {children}
        </div>
    )
}
