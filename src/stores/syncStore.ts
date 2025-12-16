import { create } from 'zustand'

interface SyncJob {
    id: string
    workspaceId: string
    poolId: string
    source: 'LIKES' | 'BOOKMARKS' | 'TIMELINE'
    status: 'PENDING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED' | 'CANCELLED'
    options: {
        limit?: number
        mediaOnly?: boolean
        excludeAuthors?: string[]
        includeReplies?: boolean
    }
    progress: {
        discovered: number
        submitted: number
        ingested: number
        failed: number
        deduped: number
    }
    lastCursor?: string
    totalItems: number
    successCount: number
    failCount: number
    dedupedCount: number
    error?: string
    startedAt?: string
    completedAt?: string
    createdAt: string
    updatedAt: string
    pool?: {
        id: string
        name: string
    }
}

interface SyncState {
    jobs: SyncJob[]
    currentJob: SyncJob | null
    isLoading: boolean
    isSubmitting: boolean
    error: string | null

    fetchJobs: (workspaceId: string) => Promise<void>
    createJob: (data: {
        workspaceId: string
        poolId: string
        source: 'LIKES' | 'BOOKMARKS' | 'TIMELINE'
        options?: SyncJob['options']
    }) => Promise<SyncJob | null>
    getJob: (jobId: string) => Promise<void>
    pauseJob: (jobId: string) => Promise<void>
    resumeJob: (jobId: string) => Promise<void>
    cancelJob: (jobId: string) => Promise<void>
    deleteJob: (jobId: string) => Promise<void>
    updateProgress: (jobId: string, data: {
        progress?: Partial<SyncJob['progress']>
        lastCursor?: string
        items?: Array<{
            sourceId: string
            sourceUrl: string
            authorHandle?: string
            textOriginal?: string
        }>
    }) => Promise<void>
}

export const useSyncStore = create<SyncState>((set, get) => ({
    jobs: [],
    currentJob: null,
    isLoading: false,
    isSubmitting: false,
    error: null,

    fetchJobs: async (workspaceId: string) => {
        set({ isLoading: true, error: null })
        try {
            const res = await fetch(`/api/sync/jobs?workspaceId=${workspaceId}`)
            if (!res.ok) throw new Error('Failed to fetch sync jobs')
            const jobs = await res.json()
            set({ jobs, isLoading: false })
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false })
        }
    },

    createJob: async (data) => {
        set({ isSubmitting: true, error: null })
        try {
            const res = await fetch('/api/sync/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            })
            if (!res.ok) {
                const error = await res.json()
                throw new Error(error.error || 'Failed to create sync job')
            }
            const job = await res.json()
            set(state => ({
                jobs: [job, ...state.jobs],
                currentJob: job,
                isSubmitting: false
            }))
            return job
        } catch (error) {
            set({ error: (error as Error).message, isSubmitting: false })
            return null
        }
    },

    getJob: async (jobId: string) => {
        set({ isLoading: true, error: null })
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`)
            if (!res.ok) throw new Error('Failed to fetch sync job')
            const job = await res.json()
            set({ currentJob: job, isLoading: false })
        } catch (error) {
            set({ error: (error as Error).message, isLoading: false })
        }
    },

    pauseJob: async (jobId: string) => {
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'pause' })
            })
            if (!res.ok) throw new Error('Failed to pause job')
            const job = await res.json()
            set(state => ({
                jobs: state.jobs.map(j => j.id === jobId ? job : j),
                currentJob: state.currentJob?.id === jobId ? job : state.currentJob
            }))
        } catch (error) {
            set({ error: (error as Error).message })
        }
    },

    resumeJob: async (jobId: string) => {
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'resume' })
            })
            if (!res.ok) throw new Error('Failed to resume job')
            const job = await res.json()
            set(state => ({
                jobs: state.jobs.map(j => j.id === jobId ? job : j),
                currentJob: state.currentJob?.id === jobId ? job : state.currentJob
            }))
        } catch (error) {
            set({ error: (error as Error).message })
        }
    },

    cancelJob: async (jobId: string) => {
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancel' })
            })
            if (!res.ok) throw new Error('Failed to cancel job')
            const job = await res.json()
            set(state => ({
                jobs: state.jobs.map(j => j.id === jobId ? job : j),
                currentJob: state.currentJob?.id === jobId ? job : state.currentJob
            }))
        } catch (error) {
            set({ error: (error as Error).message })
        }
    },

    deleteJob: async (jobId: string) => {
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`, {
                method: 'DELETE'
            })
            if (!res.ok) throw new Error('Failed to delete job')
            set(state => ({
                jobs: state.jobs.filter(j => j.id !== jobId),
                currentJob: state.currentJob?.id === jobId ? null : state.currentJob
            }))
        } catch (error) {
            set({ error: (error as Error).message })
        }
    },

    updateProgress: async (jobId: string, data) => {
        try {
            const res = await fetch(`/api/sync/jobs/${jobId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: data.items ? 'add_items' : 'update_progress',
                    ...data
                })
            })
            if (!res.ok) throw new Error('Failed to update progress')
            const job = await res.json()
            set(state => ({
                jobs: state.jobs.map(j => j.id === jobId ? job : j),
                currentJob: state.currentJob?.id === jobId ? job : state.currentJob
            }))
        } catch (error) {
            set({ error: (error as Error).message })
        }
    }
}))
