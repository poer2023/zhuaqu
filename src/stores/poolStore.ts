import { create } from 'zustand'

interface Tag {
    id: string
    name: string
    color?: string
}

interface ContentItem {
    id: string
    workspaceId: string
    poolId: string
    sourceId: string
    sourceUrl: string
    authorHandle: string
    authorName?: string
    textOriginal: string
    media: unknown[]
    captureStatus: string
    rewriteStatus: string
    publishStatus: string
    tags: Tag[]
    notes?: string
    createdAt: string
    pool?: { id: string; name: string }
    hasApprovedRewrite?: boolean
    rewriteCount?: number
}

interface PageInfo {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
}

interface Filters {
    q?: string
    tags?: string[]
    author?: string
    captureStatus?: string
    rewriteStatus?: string
    publishStatus?: string
    mediaType?: string
}

interface PoolState {
    // 数据
    items: ContentItem[]
    pageInfo: PageInfo | null
    selectedItemIds: string[]

    // 筛选
    filters: Filters

    // 加载状态
    isLoading: boolean
    error: string | null

    // Actions
    fetchItems: (workspaceId: string, poolId?: string, page?: number) => Promise<void>
    setFilters: (filters: Partial<Filters>) => void
    clearFilters: () => void

    // 选择
    selectItem: (itemId: string) => void
    deselectItem: (itemId: string) => void
    selectAll: () => void
    clearSelection: () => void

    // 批量操作
    addTagsToItems: (itemIds: string[], tagIds: string[]) => Promise<void>
    moveItems: (itemIds: string[], poolId: string) => Promise<void>
    archiveItems: (itemIds: string[]) => Promise<void>
    deleteItems: (itemIds: string[]) => Promise<void>
}

export const usePoolStore = create<PoolState>()((set, get) => ({
    // 初始状态
    items: [],
    pageInfo: null,
    selectedItemIds: [],
    filters: {},
    isLoading: false,
    error: null,

    // 获取内容项
    fetchItems: async (workspaceId: string, poolId?: string, page = 1) => {
        set({ isLoading: true, error: null })
        try {
            const { filters } = get()
            const params = new URLSearchParams()
            params.set('workspaceId', workspaceId)
            params.set('page', String(page))

            if (poolId) params.set('poolId', poolId)
            if (filters.q) params.set('q', filters.q)
            if (filters.author) params.set('author', filters.author)
            if (filters.rewriteStatus) params.set('rewriteStatus', filters.rewriteStatus)
            if (filters.publishStatus) params.set('publishStatus', filters.publishStatus)
            if (filters.mediaType) params.set('mediaType', filters.mediaType)
            if (filters.tags?.length) params.set('tags', filters.tags.join(','))

            const response = await fetch(`/api/pools/items?${params}`)
            if (!response.ok) throw new Error('Failed to fetch items')

            const data = await response.json()
            set({
                items: data.items,
                pageInfo: data.pageInfo,
                isLoading: false,
            })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    // 设置筛选条件
    setFilters: (newFilters: Partial<Filters>) => {
        set(state => ({
            filters: { ...state.filters, ...newFilters }
        }))
    },

    // 清除筛选
    clearFilters: () => {
        set({ filters: {} })
    },

    // 选择项
    selectItem: (itemId: string) => {
        set(state => ({
            selectedItemIds: state.selectedItemIds.includes(itemId)
                ? state.selectedItemIds
                : [...state.selectedItemIds, itemId]
        }))
    },

    deselectItem: (itemId: string) => {
        set(state => ({
            selectedItemIds: state.selectedItemIds.filter(id => id !== itemId)
        }))
    },

    selectAll: () => {
        set(state => ({
            selectedItemIds: state.items.map(item => item.id)
        }))
    },

    clearSelection: () => {
        set({ selectedItemIds: [] })
    },

    // 批量操作
    addTagsToItems: async (itemIds: string[], tagIds: string[]) => {
        try {
            const response = await fetch('/api/pools/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'addTags',
                    itemIds,
                    data: { tagIds },
                }),
            })

            if (!response.ok) throw new Error('Failed to add tags')

            // 刷新数据
            // Note: 需要 workspaceId 和 poolId 来刷新，这里简化处理
        } catch (error) {
            set({ error: String(error) })
        }
    },

    moveItems: async (itemIds: string[], poolId: string) => {
        try {
            const response = await fetch('/api/pools/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'move',
                    itemIds,
                    data: { poolId },
                }),
            })

            if (!response.ok) throw new Error('Failed to move items')

            set(state => ({
                items: state.items.filter(item => !itemIds.includes(item.id)),
                selectedItemIds: [],
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    archiveItems: async (itemIds: string[]) => {
        try {
            const response = await fetch('/api/pools/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'archive',
                    itemIds,
                }),
            })

            if (!response.ok) throw new Error('Failed to archive items')

            set(state => ({
                items: state.items.filter(item => !itemIds.includes(item.id)),
                selectedItemIds: [],
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    deleteItems: async (itemIds: string[]) => {
        try {
            const response = await fetch('/api/pools/items', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'delete',
                    itemIds,
                }),
            })

            if (!response.ok) throw new Error('Failed to delete items')

            set(state => ({
                items: state.items.filter(item => !itemIds.includes(item.id)),
                selectedItemIds: [],
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },
}))
