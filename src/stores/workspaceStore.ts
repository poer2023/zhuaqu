import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface Workspace {
    id: string
    name: string
    description?: string
    defaultPoolId?: string
    pools: Pool[]
    _count?: {
        contentItems: number
        tags: number
    }
}

interface Pool {
    id: string
    name: string
    description?: string
    _count?: {
        contentItems: number
    }
}

interface WorkspaceState {
    // 数据
    workspaces: Workspace[]
    currentWorkspaceId: string | null
    currentWorkspace: Workspace | null

    // 加载状态
    isLoading: boolean
    error: string | null

    // Actions
    setCurrentWorkspace: (workspaceId: string) => void
    fetchWorkspaces: () => Promise<void>
    createWorkspace: (name: string, description?: string) => Promise<Workspace | null>
    updateWorkspace: (workspaceId: string, data: Partial<Workspace>) => Promise<void>
    deleteWorkspace: (workspaceId: string) => Promise<void>
}

export const useWorkspaceStore = create<WorkspaceState>()(
    persist(
        (set, get) => ({
            // 初始状态
            workspaces: [],
            currentWorkspaceId: null,
            currentWorkspace: null,
            isLoading: false,
            error: null,

            // 设置当前工作区
            setCurrentWorkspace: (workspaceId: string) => {
                const workspace = get().workspaces.find(w => w.id === workspaceId) || null
                set({ currentWorkspaceId: workspaceId, currentWorkspace: workspace })
            },

            // 获取所有工作区
            fetchWorkspaces: async () => {
                set({ isLoading: true, error: null })
                try {
                    const response = await fetch('/api/workspaces')
                    if (!response.ok) throw new Error('Failed to fetch workspaces')

                    const data = await response.json()
                    const workspaces = data.workspaces || []

                    // 获取当前持久化的工作区ID
                    const { currentWorkspaceId } = get()

                    // 从工作区列表中查找当前工作区
                    let currentWorkspace = null
                    if (currentWorkspaceId) {
                        currentWorkspace = workspaces.find((w: { id: string }) => w.id === currentWorkspaceId) || null
                    }

                    // 如果持久化的工作区不存在或为空，选择第一个
                    if (!currentWorkspace && workspaces.length > 0) {
                        currentWorkspace = workspaces[0]
                    }

                    set({
                        workspaces,
                        isLoading: false,
                        currentWorkspace,
                        currentWorkspaceId: currentWorkspace?.id || null
                    })
                } catch (error) {
                    set({ error: String(error), isLoading: false })
                }
            },

            // 创建工作区
            createWorkspace: async (name: string, description?: string) => {
                set({ isLoading: true, error: null })
                try {
                    const response = await fetch('/api/workspaces', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name, description }),
                    })

                    if (!response.ok) throw new Error('Failed to create workspace')

                    const data = await response.json()
                    set(state => ({
                        workspaces: [data.workspace, ...state.workspaces],
                        isLoading: false,
                    }))

                    return data.workspace
                } catch (error) {
                    set({ error: String(error), isLoading: false })
                    return null
                }
            },

            // 更新工作区
            updateWorkspace: async (workspaceId: string, data: Partial<Workspace>) => {
                try {
                    const response = await fetch(`/api/workspaces/${workspaceId}`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                    })

                    if (!response.ok) throw new Error('Failed to update workspace')

                    const result = await response.json()
                    set(state => ({
                        workspaces: state.workspaces.map(w =>
                            w.id === workspaceId ? { ...w, ...result.workspace } : w
                        ),
                        currentWorkspace: state.currentWorkspaceId === workspaceId
                            ? { ...state.currentWorkspace!, ...result.workspace }
                            : state.currentWorkspace,
                    }))
                } catch (error) {
                    set({ error: String(error) })
                }
            },

            // 删除工作区
            deleteWorkspace: async (workspaceId: string) => {
                try {
                    const response = await fetch(`/api/workspaces/${workspaceId}`, {
                        method: 'DELETE',
                    })

                    if (!response.ok) throw new Error('Failed to delete workspace')

                    set(state => ({
                        workspaces: state.workspaces.filter(w => w.id !== workspaceId),
                        currentWorkspaceId: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspaceId,
                        currentWorkspace: state.currentWorkspaceId === workspaceId ? null : state.currentWorkspace,
                    }))
                } catch (error) {
                    set({ error: String(error) })
                }
            },
        }),
        {
            name: 'workspace-storage',
            partialize: (state) => ({
                currentWorkspaceId: state.currentWorkspaceId,
            }),
        }
    )
)
