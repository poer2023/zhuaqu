import { create } from 'zustand'

interface AuditLog {
    id: string
    workspaceId: string
    contentItemId?: string
    action: string
    details: Record<string, unknown>
    actor: string
    createdAt: string
    contentItem?: {
        id: string
        sourceUrl: string
        authorHandle: string
        textOriginal: string
    }
}

interface PageInfo {
    page: number
    limit: number
    total: number
    totalPages: number
}

interface AuditState {
    logs: AuditLog[]
    pageInfo: PageInfo | null
    isLoading: boolean
    error: string | null

    // Filters
    actionFilter: string | null

    // Actions
    fetchLogs: (workspaceId: string, page?: number) => Promise<void>
    setActionFilter: (action: string | null) => void
}

export const useAuditStore = create<AuditState>()((set, get) => ({
    logs: [],
    pageInfo: null,
    isLoading: false,
    error: null,
    actionFilter: null,

    fetchLogs: async (workspaceId: string, page = 1) => {
        set({ isLoading: true, error: null })
        try {
            const { actionFilter } = get()
            const params = new URLSearchParams()
            params.set('workspaceId', workspaceId)
            params.set('page', String(page))
            if (actionFilter) params.set('action', actionFilter)

            const response = await fetch(`/api/audit?${params}`)
            if (!response.ok) throw new Error('Failed to fetch audit logs')

            const data = await response.json()
            set({
                logs: data.logs,
                pageInfo: data.pageInfo,
                isLoading: false,
            })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    setActionFilter: (action: string | null) => {
        set({ actionFilter: action })
    },
}))
