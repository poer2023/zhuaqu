import { create } from 'zustand'

interface IngestJob {
    id: string
    workspaceId: string
    poolId: string
    urls: string[]
    options: Record<string, unknown>
    tags: string[]
    notes?: string
    status: 'QUEUED' | 'RUNNING' | 'DONE' | 'PARTIAL_FAILED'
    total: number
    succeeded: number
    failed: number
    deduped: number
    failures: Array<{ url: string; error: string }>
    createdAt: string
    pool?: { id: string; name: string }
}

interface IngestState {
    // 数据
    jobs: IngestJob[]
    currentJob: IngestJob | null

    // 加载状态
    isLoading: boolean
    isSubmitting: boolean
    error: string | null

    // Actions
    fetchJobs: (workspaceId: string) => Promise<void>
    createJob: (data: {
        workspaceId: string
        poolId: string
        urls: string[]
        tags?: string[]
        notes?: string
        options?: Record<string, unknown>
    }) => Promise<IngestJob | null>
    getJob: (jobId: string) => Promise<IngestJob | null>
    clearCurrentJob: () => void
}

export const useIngestStore = create<IngestState>()((set) => ({
    // 初始状态
    jobs: [],
    currentJob: null,
    isLoading: false,
    isSubmitting: false,
    error: null,

    // 获取入库任务列表
    fetchJobs: async (workspaceId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await fetch(`/api/ingest/jobs?workspaceId=${workspaceId}`)
            if (!response.ok) throw new Error('Failed to fetch ingest jobs')

            const data = await response.json()
            set({ jobs: data.jobs, isLoading: false })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    // 创建入库任务
    createJob: async (data) => {
        set({ isSubmitting: true, error: null })
        try {
            const response = await fetch('/api/ingest/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!response.ok) throw new Error('Failed to create ingest job')

            const result = await response.json()
            set(state => ({
                jobs: [result.job, ...state.jobs],
                currentJob: result.job,
                isSubmitting: false,
            }))

            return result.job
        } catch (error) {
            set({ error: String(error), isSubmitting: false })
            return null
        }
    },

    // 获取单个任务详情
    getJob: async (jobId: string) => {
        try {
            const response = await fetch(`/api/ingest/jobs/${jobId}`)
            if (!response.ok) throw new Error('Failed to fetch ingest job')

            const data = await response.json()
            set({ currentJob: data.job })
            return data.job
        } catch (error) {
            set({ error: String(error) })
            return null
        }
    },

    // 清除当前任务
    clearCurrentJob: () => {
        set({ currentJob: null })
    },
}))
