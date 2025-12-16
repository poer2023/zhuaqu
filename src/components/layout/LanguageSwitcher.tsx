"use client"

import { useTranslations } from "@/stores/localeStore"
import { locales, localeNames, type Locale } from "@/i18n"
import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { Globe, Check } from "lucide-react"

interface LanguageSwitcherProps {
    collapsed?: boolean
}

export function LanguageSwitcher({ collapsed }: LanguageSwitcherProps) {
    const { locale, setLocale } = useTranslations()

    const trigger = (
        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
            <Globe className="h-4 w-4" strokeWidth={1.5} />
        </Button>
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {collapsed ? (
                    <Tooltip>
                        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
                        <TooltipContent side="right">Language</TooltipContent>
                    </Tooltip>
                ) : (
                    trigger
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align={collapsed ? "center" : "end"} side={collapsed ? "right" : "bottom"} className="min-w-[120px]">
                {locales.map((loc) => (
                    <DropdownMenuItem
                        key={loc}
                        onClick={() => setLocale(loc as Locale)}
                        className="flex items-center justify-between"
                    >
                        <span>{localeNames[loc]}</span>
                        {locale === loc && (
                            <Check className="h-3.5 w-3.5 text-primary" strokeWidth={2} />
                        )}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
