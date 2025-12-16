"use client"

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { type Locale, defaultLocale, getTranslations, type Translations } from '@/i18n'

interface LocaleState {
    locale: Locale
    setLocale: (locale: Locale) => void
    t: Translations
}

export const useLocaleStore = create<LocaleState>()(
    persist(
        (set) => ({
            locale: defaultLocale,
            t: getTranslations(defaultLocale),
            setLocale: (locale: Locale) => {
                set({
                    locale,
                    t: getTranslations(locale),
                })
            },
        }),
        {
            name: 'locale-storage',
            partialize: (state) => ({ locale: state.locale }),
            onRehydrateStorage: () => (state) => {
                // 重新水化时更新翻译
                if (state) {
                    state.t = getTranslations(state.locale)
                }
            },
        }
    )
)

// Hook for easy access
export function useTranslations() {
    const { t, locale, setLocale } = useLocaleStore()
    return { t, locale, setLocale }
}
