"use client"

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query"
import { api, buildQueryString, parseApiError, type PaginatedResponse } from "@/lib/api-client"
import type { ContentItem } from "@/components/content/ContentCard"

// ==================== Query Keys ====================

export const contentKeys = {
    all: ["content"] as const,
    lists: () => [...contentKeys.all, "list"] as const,
    list: (filters: ContentListParams) => [...contentKeys.lists(), filters] as const,
    details: () => [...contentKeys.all, "detail"] as const,
    detail: (id: string) => [...contentKeys.details(), id] as const,
}

// ==================== Types ====================

interface ContentListParams {
    workspaceId: string
    poolId?: string
    search?: string
    statusFilter?: string
    limit?: number
}

interface ContentListResponse extends PaginatedResponse<ContentItem> {
    nextCursor?: string
}

// ==================== Hooks ====================

/**
 * Fetch content items with cursor-based pagination
 */
export function useContentItems(params: ContentListParams) {
    return useInfiniteQuery({
        queryKey: contentKeys.list(params),
        queryFn: async ({ pageParam }) => {
            const query = buildQueryString({
                ...params,
                cursor: pageParam as string | undefined,
            })
            return api.get<ContentListResponse>(`/api/pools/items${query}`)
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        enabled: !!params.workspaceId,
        staleTime: 30 * 1000, // 30 seconds
    })
}

/**
 * Fetch single content item
 */
export function useContentItem(id: string) {
    return useQuery({
        queryKey: contentKeys.detail(id),
        queryFn: () => api.get<ContentItem>(`/api/content-items/${id}`),
        enabled: !!id,
    })
}

/**
 * Delete content item mutation
 */
export function useDeleteContentItem() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (id: string) => api.delete(`/api/content-items/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
        },
        onError: (error) => {
            console.error("Delete failed:", parseApiError(error))
        },
    })
}

/**
 * Batch action mutation
 */
export function useBatchAction() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ action, itemIds, data }: { action: string; itemIds: string[]; data?: unknown }) =>
            api.post("/api/pools/items", { action, itemIds, data }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: contentKeys.lists() })
        },
    })
}

// ==================== Dashboard Hooks ====================

export const dashboardKeys = {
    all: ["dashboard"] as const,
    stats: () => [...dashboardKeys.all, "stats"] as const,
}

interface DashboardData {
    jobs: { total: number; byStatus: Record<string, number>; byType: Record<string, number> }
    steps: { total: number; byStatus: Record<string, number>; byType: Record<string, number>; avgDurationMs: number | null }
    recentFailures: Array<{ id: string; jobId: string; type: string; status: string; error: string | null; createdAt: string }>
    ingestJobs: { total: number; succeeded: number; failed: number; running: number }
    contentItems: { total: number; byStatus: Record<string, number> }
    lastUpdated: string
}

export function useDashboard() {
    return useQuery({
        queryKey: dashboardKeys.stats(),
        queryFn: () => api.get<DashboardData>("/api/dashboard"),
        refetchInterval: 30 * 1000, // Auto-refresh every 30 seconds
        staleTime: 10 * 1000,
    })
}

// ==================== Jobs Hooks ====================

export const jobsKeys = {
    all: ["jobs"] as const,
    lists: () => [...jobsKeys.all, "list"] as const,
    list: (filters: JobListParams) => [...jobsKeys.lists(), filters] as const,
    details: () => [...jobsKeys.all, "detail"] as const,
    detail: (id: string) => [...jobsKeys.details(), id] as const,
}

interface JobListParams {
    workspaceId: string
    type?: string
    status?: string
    limit?: number
}

export function useJobs(params: JobListParams) {
    return useInfiniteQuery({
        queryKey: jobsKeys.list(params),
        queryFn: async ({ pageParam }) => {
            const query = buildQueryString({
                ...params,
                cursor: pageParam as string | undefined,
            })
            return api.get<PaginatedResponse<unknown>>(`/api/jobs${query}`)
        },
        initialPageParam: undefined as string | undefined,
        getNextPageParam: (lastPage) => lastPage.hasMore ? (lastPage as { nextCursor?: string }).nextCursor : undefined,
        enabled: !!params.workspaceId,
    })
}
