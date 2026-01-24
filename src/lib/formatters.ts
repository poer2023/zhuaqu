/**
 * Unified formatting utilities
 * Eliminates duplicate formatting logic across the codebase
 */

import { format, formatDistanceToNow, parseISO } from "date-fns"
import { zhCN } from "date-fns/locale"

// ==================== Number Formatting ====================

/**
 * Format large numbers with K/M suffixes
 * @example formatNumber(1500) => "1.5K"
 * @example formatNumber(1500000) => "1.5M"
 */
export function formatNumber(num?: number | null): string {
  if (num === undefined || num === null) return "0"
  if (num >= 1000000) return (num / 1000000).toFixed(1).replace(/\.0$/, "") + "M"
  if (num >= 1000) return (num / 1000).toFixed(1).replace(/\.0$/, "") + "K"
  return num.toString()
}

/**
 * Format bytes to human-readable size
 * @example formatBytes(1024) => "1 KB"
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return "0 Bytes"
  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + " " + sizes[i]
}

/**
 * Format percentage
 * @example formatPercent(0.756) => "75.6%"
 */
export function formatPercent(value: number, decimals = 1): string {
  return (value * 100).toFixed(decimals) + "%"
}

// ==================== Date Formatting ====================

/**
 * Format date for display (short format)
 * @example formatDate("2024-01-15T10:30:00Z") => "Jan 15, 2024, 10:30 AM"
 */
export function formatDate(dateString: string | Date | null | undefined): string {
  if (!dateString) return ""
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString
    return format(date, "MMM d, yyyy, h:mm a")
  } catch {
    return ""
  }
}

/**
 * Format date in Chinese locale
 * @example formatDateZh("2024-01-15T10:30:00Z") => "2024年1月15日 10:30"
 */
export function formatDateZh(dateString: string | Date | null | undefined): string {
  if (!dateString) return ""
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString
    return format(date, "yyyy年M月d日 HH:mm", { locale: zhCN })
  } catch {
    return ""
  }
}

/**
 * Format relative time
 * @example formatRelativeTime("2024-01-15T10:30:00Z") => "2 hours ago"
 */
export function formatRelativeTime(dateString: string | Date | null | undefined): string {
  if (!dateString) return ""
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString
    return formatDistanceToNow(date, { addSuffix: true })
  } catch {
    return ""
  }
}

/**
 * Format relative time in Chinese
 */
export function formatRelativeTimeZh(dateString: string | Date | null | undefined): string {
  if (!dateString) return ""
  try {
    const date = typeof dateString === "string" ? parseISO(dateString) : dateString
    return formatDistanceToNow(date, { addSuffix: true, locale: zhCN })
  } catch {
    return ""
  }
}

/**
 * Format duration in milliseconds to human readable
 * @example formatDuration(65000) => "1m 5s"
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return "N/A"

  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`

  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes < 60) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

// ==================== Text Formatting ====================

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + "..."
}

/**
 * Pluralize a word based on count
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  return count === 1 ? singular : (plural || singular + "s")
}
