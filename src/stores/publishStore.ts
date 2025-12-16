import { create } from 'zustand'

interface PublishJob {
    id: string
    workspaceId: string
    xAccountId: string
    rewriteVersionId: string
    mode: 'single' | 'thread'
    scheduledAt?: string
    status: 'QUEUED' | 'PUBLISHED' | 'FAILED' | 'NOT_PUBLISHED'
    retryCount: number
    maxRetries: number
    lastError?: string
    resultMap: Record<string, string>
    createdAt: string
    rewriteVersion?: {
        id: string
        output: { text: string }
        contentItem?: {
            id: string
            sourceUrl: string
            authorHandle: string
            textOriginal: string
        }
    }
    xAccount?: {
        id: string
        xUsername: string
        xDisplayName?: string
    }
    publishResults?: Array<{
        id: string
        tweetId: string
        tweetUrl: string
        position: number
        publishedAt: string
    }>
}

interface PublishState {
    // 数据
    jobs: PublishJob[]
    queuePaused: boolean

    // 加载状态
    isLoading: boolean
    isSubmitting: boolean
    error: string | null

    // Actions
    fetchJobs: (workspaceId: string) => Promise<void>
    createJobs: (data: {
        workspaceId: string
        rewriteVersionIds: string[]
        mode?: 'single' | 'thread'
        scheduledAt?: string
    }) => Promise<PublishJob[] | null>

    // 任务操作
    cancelJob: (jobId: string) => Promise<void>
    retryJob: (jobId: string) => Promise<void>
    deleteJob: (jobId: string) => Promise<void>

    // 队列控制
    pauseQueue: () => void
    resumeQueue: () => void
}

export const usePublishStore = create<PublishState>()((set, get) => ({
    // 初始状态
    jobs: [],
    queuePaused: false,
    isLoading: false,
    isSubmitting: false,
    error: null,

    // 获取发布任务列表
    fetchJobs: async (workspaceId: string) => {
        set({ isLoading: true, error: null })
        try {
            const response = await fetch(`/api/publish/jobs?workspaceId=${workspaceId}`)
            if (!response.ok) throw new Error('Failed to fetch publish jobs')

            const data = await response.json()
            set({ jobs: data.jobs, isLoading: false })
        } catch (error) {
            set({ error: String(error), isLoading: false })
        }
    },

    // 创建发布任务
    createJobs: async (data) => {
        set({ isSubmitting: true, error: null })
        try {
            const response = await fetch('/api/publish/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            })

            if (!response.ok) {
                const errorData = await response.json()
                throw new Error(errorData.error || 'Failed to create publish jobs')
            }

            const result = await response.json()
            set(state => ({
                jobs: [...result.jobs, ...state.jobs],
                isSubmitting: false,
            }))

            return result.jobs
        } catch (error) {
            set({ error: String(error), isSubmitting: false })
            return null
        }
    },

    // 取消任务
    cancelJob: async (jobId: string) => {
        try {
            const response = await fetch(`/api/publish/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel' }),
            })

            if (!response.ok) throw new Error('Failed to cancel job')

            set(state => ({
                jobs: state.jobs.map(j =>
                    j.id === jobId ? { ...j, status: 'NOT_PUBLISHED' as const } : j
                )
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    // 重试任务
    retryJob: async (jobId: string) => {
        try {
            const response = await fetch(`/api/publish/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'retry' }),
            })

            if (!response.ok) throw new Error('Failed to retry job')

            set(state => ({
                jobs: state.jobs.map(j =>
                    j.id === jobId ? { ...j, status: 'QUEUED' as const, lastError: undefined } : j
                )
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    // 删除任务
    deleteJob: async (jobId: string) => {
        try {
            const response = await fetch(`/api/publish/jobs/${jobId}`, {
                method: 'DELETE',
            })

            if (!response.ok) throw new Error('Failed to delete job')

            set(state => ({
                jobs: state.jobs.filter(j => j.id !== jobId)
            }))
        } catch (error) {
            set({ error: String(error) })
        }
    },

    // 队列控制
    pauseQueue: () => {
        set({ queuePaused: true })
    },

    resumeQueue: () => {
        set({ queuePaused: false })
    },
}))
