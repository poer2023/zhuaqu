import { create } from 'zustand'

interface RewriteVersion {
    id: string
    contentItemId: string
    batchId?: string
    version: number
    output: { text: string } | { text: string; position: number }[]
    outputFormat: string
    status: 'GENERATED' | 'APPROVED' | 'REWORK' | 'REJECTED'
    charCount?: number
    similarityScore?: number
    warnings: string[]
    reviewedAt?: string
    reviewNotes?: string
    contentItem?: {
        id: string
        sourceUrl: string
        authorHandle: string
        textOriginal: string
    }
}

interface RewriteBatch {
    id: string
    workspaceId: string
    presetId?: string
    name: string
    params: Record<string, unknown>
    status: 'QUEUED' | 'RUNNING' | 'DONE' | 'PARTIAL_FAILED'
    total: number
    succeeded: number
    failed: number
    createdAt: string
    versions?: RewriteVersion[]
}

interface RewriteState {
    // 数据
    batches: RewriteBatch[]
    currentBatch: RewriteBatch | null
    currentVersionIndex: number

    // 加载状态
    isLoading: boolean
    isSubmitting: boolean
    isGenerating: boolean
    error: string | null

    // Actions
    fetchBatches: (workspaceId: string) => Promise<void>
    getBatch: (batchId: string) => Promise<RewriteBatch | null>
    createBatch: (data: {
        workspaceId: string
        itemIds: string[]
        presetId?: string
        name?: string
        params?: Record<string, unknown>
    }) => Promise<RewriteBatch | null>

    // 版本导航
    setCurrentVersionIndex: (index: number) => void
    nextVersion: () => void
    prevVersion: () => void

    // 审阅操作
    approveVersion: (versionId: string, notes?: string) => Promise<void>
    rejectVersion: (versionId: string, notes?: string) => Promise<void>
    reworkVersion: (versionId: string, notes?: string) => Promise<void>
    editVersion: (versionId: string, output: { text: string }) => Promise<void>

    // 流式改写
    streamingText: string
    isStreaming: boolean
    selectedBrandVoiceId: string | null
    setSelectedBrandVoiceId: (id: string | null) => void
    streamRewrite: (
        originalText: string,
        params?: Record<string, unknown>,
        onChunk?: (text: string) => void,
        meta?: { workspaceId?: string; contentItemId?: string; force?: boolean; brandVoiceId?: string }
    ) => Promise<string>
    clearStreamingText: () => void
}

export const useRewriteStore = create<RewriteState>()((set, get) => ({
    // 初始状态
    batches: [],
    currentBatch: null,
    currentVersionIndex: 0,
    isLoading: false,
    isSubmitting: false,
    isGenerating: false,
    error: null,

    // 获取批次列表
    fetchBatches: async (workspaceId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await fetch(`/api/rewrite/batches?workspaceId=${workspaceId}`)
            if (!response.ok) throw new Error('Failed to fetch batches')

            const data = await response.json()
            set({ batches: data.batches, isLoading: false })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    // 获取批次详情
    getBatch: async (batchId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await fetch(`/api/rewrite/batches/${batchId}`)
            if (!response.ok) throw new Error('Failed to fetch batch')

            const data = await response.json()
            set({
                currentBatch: data.batch,
                currentVersionIndex: 0,
                isLoading: false,
            })
            return data.batch
        } catch (error) {
            set({ error: String(error), isLoading: false })
            return null
        }
    },

    // 创建批次
    createBatch: async (data) => {
        set({ isSubmitting: true, isGenerating: true, error: null })
        try {
            const response = await fetch('/api/rewrite/batches', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!response.ok) throw new Error('Failed to create batch')

            const result = await response.json()

            // 获取完整批次详情
            await get().getBatch(result.batch.id)

            set(state => ({
                batches: [result.batch, ...state.batches],
                isSubmitting: false,
                isGenerating: false,
            }))

            return result.batch
        } catch (error) {
            set({ error: String(error), isSubmitting: false, isGenerating: false })
            return null
        }
    },

    // 版本导航
    setCurrentVersionIndex: (index: number) => {
        set({ currentVersionIndex: index })
    },

    nextVersion: () => {
        const { currentBatch, currentVersionIndex } = get()
        if (currentBatch?.versions && currentVersionIndex < currentBatch.versions.length - 1) {
            set({ currentVersionIndex: currentVersionIndex + 1 })
        }
    },

    prevVersion: () => {
        const { currentVersionIndex } = get()
        if (currentVersionIndex > 0) {
            set({ currentVersionIndex: currentVersionIndex - 1 })
        }
    },

    // 审阅操作
    approveVersion: async (versionId: string, notes?: string) => {
        try {
            const response = await fetch(`/api/rewrite/versions/${versionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'approve', reviewNotes: notes }),
            })

            if (!response.ok) throw new Error('Failed to approve version')

            // 更新本地状态
            set(state => ({
                currentBatch: state.currentBatch ? {
                    ...state.currentBatch,
                    versions: state.currentBatch.versions?.map(v =>
                        v.id === versionId ? { ...v, status: 'APPROVED' as const, reviewNotes: notes } : v
                    )
                } : null
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    rejectVersion: async (versionId: string, notes?: string) => {
        try {
            const response = await fetch(`/api/rewrite/versions/${versionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reject', reviewNotes: notes }),
            })

            if (!response.ok) throw new Error('Failed to reject version')

            set(state => ({
                currentBatch: state.currentBatch ? {
                    ...state.currentBatch,
                    versions: state.currentBatch.versions?.map(v =>
                        v.id === versionId ? { ...v, status: 'REJECTED' as const, reviewNotes: notes } : v
                    )
                } : null
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    reworkVersion: async (versionId: string, notes?: string) => {
        try {
            const response = await fetch(`/api/rewrite/versions/${versionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'rework', reviewNotes: notes }),
            })

            if (!response.ok) throw new Error('Failed to mark for rework')

            set(state => ({
                currentBatch: state.currentBatch ? {
                    ...state.currentBatch,
                    versions: state.currentBatch.versions?.map(v =>
                        v.id === versionId ? { ...v, status: 'REWORK' as const, reviewNotes: notes } : v
                    )
                } : null
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    editVersion: async (versionId: string, output: { text: string }) => {
        try {
            const response = await fetch(`/api/rewrite/versions/${versionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'edit', output }),
            })

            if (!response.ok) throw new Error('Failed to edit version')

            set(state => ({
                currentBatch: state.currentBatch ? {
                    ...state.currentBatch,
                    versions: state.currentBatch.versions?.map(v =>
                        v.id === versionId ? { ...v, output, charCount: output.text.length } : v
                    )
                } : null
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    // 流式改写
    streamingText: "",
    isStreaming: false,
    selectedBrandVoiceId: null,

    setSelectedBrandVoiceId: (id: string | null) => {
        set({ selectedBrandVoiceId: id })
    },

    streamRewrite: async (
        originalText: string,
        params?: Record<string, unknown>,
        onChunk?: (text: string) => void,
        meta?: { workspaceId?: string; contentItemId?: string; force?: boolean; brandVoiceId?: string }
    ) => {
        const { selectedBrandVoiceId } = get()
        const brandVoiceId = meta?.brandVoiceId ?? selectedBrandVoiceId

        set({ isStreaming: true, streamingText: "", error: null })

        try {
            const response = await fetch('/api/rewrite/stream', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalText, params, ...meta, brandVoiceId }),
            })

            if (!response.ok) throw new Error('Stream request failed')
            if (!response.body) throw new Error('No response body')

            const reader = response.body.getReader()
            const decoder = new TextDecoder()
            let fullText = ""

            while (true) {
                const { done, value } = await reader.read()
                if (done) break

                const chunk = decoder.decode(value, { stream: true })
                const lines = chunk.split('\n\n')

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(line.slice(6))
                            if (data.content) {
                                fullText += data.content
                                set({ streamingText: fullText })
                                onChunk?.(fullText)
                            }
                            if (data.done) {
                                set({ isStreaming: false })
                            }
                            if (data.error) {
                                throw new Error(data.error)
                            }
                        } catch {
                            // Skip invalid JSON
                        }
                    }
                }
            }

            set({ isStreaming: false })
            return fullText
        } catch (error) {
            set({ error: String(error), isStreaming: false })
            return ""
        }
    },

    clearStreamingText: () => {
        set({ streamingText: "", isStreaming: false })
    },
}))
