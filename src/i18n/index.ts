import en from './translations/en'
import zh from './translations/zh'

export const locales = ['en', 'zh'] as const
export type Locale = (typeof locales)[number]

export const defaultLocale: Locale = 'zh'

export const translations = {
    en,
    zh,
} as const

export type Translations = typeof en

// 获取翻译
export function getTranslations(locale: Locale): Translations {
    return translations[locale] || translations[defaultLocale]
}

// 语言显示名称
export const localeNames: Record<Locale, string> = {
    en: 'English',
    zh: '中文',
}
