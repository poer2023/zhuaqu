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
import { Globe, Check } from "lucide-react"

export function LanguageSwitcher() {
    const { locale, setLocale } = useTranslations()

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Globe className="h-4 w-4" strokeWidth={1.5} />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[120px]">
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
