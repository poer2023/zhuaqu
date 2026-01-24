/**
 * Status helpers for consistent badge styling across the app
 * Eliminates duplicate status-to-style mappings
 */

import { cn } from "./utils"

// ==================== Status Types ====================

export type CaptureStatus = "QUEUED" | "FETCHING" | "READY" | "FAILED"
export type RewriteStatus = "NONE" | "DRAFTING" | "GENERATED" | "APPROVED" | "REWORK" | "REJECTED"
export type PublishStatus = "NOT_PUBLISHED" | "QUEUED" | "PUBLISHED" | "FAILED" | "UNKNOWN"
export type JobStatus = "QUEUED" | "RUNNING" | "DONE" | "PARTIAL_FAILED"
export type OrchestratorJobStatus = "PENDING" | "RUNNING" | "PAUSED" | "FAILED" | "DONE" | "CANCELED"
export type OrchestratorStepStatus = "QUEUED" | "RUNNING" | "SUCCEEDED" | "FAILED" | "SKIPPED"

// ==================== Color Maps ====================

export const JOB_STATUS_COLORS: Record<string, string> = {
  PENDING: "#f59e0b",
  RUNNING: "#3b82f6",
  PAUSED: "#8b5cf6",
  FAILED: "#ef4444",
  DONE: "#22c55e",
  CANCELED: "#6b7280",
}

export const STEP_STATUS_COLORS: Record<string, string> = {
  QUEUED: "#f59e0b",
  RUNNING: "#3b82f6",
  SUCCEEDED: "#22c55e",
  FAILED: "#ef4444",
  SKIPPED: "#6b7280",
}

export const CAPTURE_STATUS_COLORS: Record<string, string> = {
  QUEUED: "#f59e0b",
  FETCHING: "#3b82f6",
  READY: "#22c55e",
  FAILED: "#ef4444",
}

export const REWRITE_STATUS_COLORS: Record<string, string> = {
  NONE: "#6b7280",
  DRAFTING: "#3b82f6",
  GENERATED: "#8b5cf6",
  APPROVED: "#22c55e",
  REWORK: "#f59e0b",
  REJECTED: "#ef4444",
}

export const PUBLISH_STATUS_COLORS: Record<string, string> = {
  NOT_PUBLISHED: "#6b7280",
  QUEUED: "#f59e0b",
  PUBLISHED: "#22c55e",
  FAILED: "#ef4444",
  UNKNOWN: "#8b5cf6",
}

// ==================== Badge Variants ====================

type BadgeVariant = "default" | "secondary" | "destructive" | "outline" | "success" | "warning"

const STATUS_BADGE_VARIANTS: Record<string, BadgeVariant> = {
  // Job/Step statuses
  PENDING: "warning",
  QUEUED: "warning",
  RUNNING: "default",
  FETCHING: "default",
  PAUSED: "secondary",
  FAILED: "destructive",
  DONE: "success",
  SUCCEEDED: "success",
  CANCELED: "outline",
  SKIPPED: "outline",
  // Rewrite statuses
  NONE: "outline",
  DRAFTING: "default",
  GENERATED: "secondary",
  APPROVED: "success",
  REWORK: "warning",
  REJECTED: "destructive",
  // Publish statuses
  NOT_PUBLISHED: "outline",
  PUBLISHED: "success",
  UNKNOWN: "secondary",
  // Capture statuses
  READY: "success",
}

/**
 * Get badge variant for a status
 */
export function getStatusBadgeVariant(status: string): BadgeVariant {
  return STATUS_BADGE_VARIANTS[status] || "outline"
}

/**
 * Get tailwind classes for status badge
 */
export function getStatusBadgeClass(status: string): string {
  const variant = getStatusBadgeVariant(status)

  const variantClasses: Record<BadgeVariant, string> = {
    default: "bg-primary text-primary-foreground",
    secondary: "bg-secondary text-secondary-foreground",
    destructive: "bg-destructive text-destructive-foreground",
    outline: "border border-input bg-background",
    success: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  }

  return cn("text-xs font-medium px-2 py-0.5 rounded-full", variantClasses[variant])
}

/**
 * Get color for status (for charts, progress bars)
 */
export function getStatusColor(status: string, category: "job" | "step" | "capture" | "rewrite" | "publish" = "job"): string {
  const colorMaps: Record<string, Record<string, string>> = {
    job: JOB_STATUS_COLORS,
    step: STEP_STATUS_COLORS,
    capture: CAPTURE_STATUS_COLORS,
    rewrite: REWRITE_STATUS_COLORS,
    publish: PUBLISH_STATUS_COLORS,
  }

  return colorMaps[category]?.[status] || "#6b7280"
}

// ==================== Status Labels ====================

const STATUS_LABELS_ZH: Record<string, string> = {
  // Job/Step
  PENDING: "等待中",
  QUEUED: "排队中",
  RUNNING: "运行中",
  PAUSED: "已暂停",
  FAILED: "失败",
  DONE: "完成",
  SUCCEEDED: "成功",
  CANCELED: "已取消",
  SKIPPED: "已跳过",
  // Capture
  FETCHING: "抓取中",
  READY: "就绪",
  // Rewrite
  NONE: "未改写",
  DRAFTING: "生成中",
  GENERATED: "已生成",
  APPROVED: "已通过",
  REWORK: "待修改",
  REJECTED: "已拒绝",
  // Publish
  NOT_PUBLISHED: "未发布",
  PUBLISHED: "已发布",
  UNKNOWN: "未知",
}

const STATUS_LABELS_EN: Record<string, string> = {
  PENDING: "Pending",
  QUEUED: "Queued",
  RUNNING: "Running",
  PAUSED: "Paused",
  FAILED: "Failed",
  DONE: "Done",
  SUCCEEDED: "Succeeded",
  CANCELED: "Canceled",
  SKIPPED: "Skipped",
  FETCHING: "Fetching",
  READY: "Ready",
  NONE: "None",
  DRAFTING: "Drafting",
  GENERATED: "Generated",
  APPROVED: "Approved",
  REWORK: "Rework",
  REJECTED: "Rejected",
  NOT_PUBLISHED: "Not Published",
  PUBLISHED: "Published",
  UNKNOWN: "Unknown",
}

/**
 * Get human-readable status label
 */
export function getStatusLabel(status: string, locale: "zh" | "en" = "en"): string {
  const labels = locale === "zh" ? STATUS_LABELS_ZH : STATUS_LABELS_EN
  return labels[status] || status
}

// ==================== Status Checks ====================

/**
 * Check if status indicates an active/in-progress state
 */
export function isActiveStatus(status: string): boolean {
  return ["RUNNING", "FETCHING", "DRAFTING", "PENDING", "QUEUED"].includes(status)
}

/**
 * Check if status indicates a successful completion
 */
export function isSuccessStatus(status: string): boolean {
  return ["DONE", "SUCCEEDED", "READY", "APPROVED", "PUBLISHED"].includes(status)
}

/**
 * Check if status indicates a failure
 */
export function isFailureStatus(status: string): boolean {
  return ["FAILED", "REJECTED", "PARTIAL_FAILED"].includes(status)
}
