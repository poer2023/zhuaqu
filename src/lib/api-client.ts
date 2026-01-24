/**
 * Unified API client with error handling and response normalization
 * Replaces scattered fetch calls throughout the codebase
 */

// ==================== Types ====================

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  code?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  hasMore: boolean
  cursor?: string
}

export interface FetchOptions extends RequestInit {
  /** Timeout in milliseconds (default: 30000) */
  timeout?: number
  /** Retry count on failure (default: 0) */
  retries?: number
  /** Base delay between retries in ms (default: 1000) */
  retryDelay?: number
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
    public details?: unknown
  ) {
    super(message)
    this.name = "ApiError"
  }
}

// ==================== Core Functions ====================

/**
 * Core fetch wrapper with timeout, retries, and error handling
 */
async function fetchWithRetry<T>(
  url: string,
  options: FetchOptions = {}
): Promise<T> {
  const {
    timeout = 30000,
    retries = 0,
    retryDelay = 1000,
    ...fetchOptions
  } = options

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        ...fetchOptions,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...fetchOptions.headers,
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        let errorData: { error?: string; message?: string; code?: string } = {}
        try {
          errorData = await response.json()
        } catch {
          // Response might not be JSON
        }

        throw new ApiError(
          errorData.error || errorData.message || `HTTP ${response.status}`,
          response.status,
          errorData.code,
          errorData
        )
      }

      // Handle empty responses
      const contentType = response.headers.get("content-type")
      if (contentType?.includes("application/json")) {
        return await response.json()
      }

      return {} as T
    } catch (error) {
      lastError = error as Error

      // Don't retry on client errors (4xx)
      if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
        throw error
      }

      // Don't retry on abort
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("Request timeout", 408)
      }

      // Wait before retrying
      if (attempt < retries) {
        await new Promise(resolve =>
          setTimeout(resolve, retryDelay * Math.pow(2, attempt))
        )
      }
    }
  }

  throw lastError || new ApiError("Unknown error", 500)
}

// ==================== HTTP Methods ====================

export const api = {
  /**
   * GET request
   */
  async get<T>(url: string, options?: FetchOptions): Promise<T> {
    return fetchWithRetry<T>(url, { ...options, method: "GET" })
  },

  /**
   * POST request
   */
  async post<T>(url: string, data?: unknown, options?: FetchOptions): Promise<T> {
    return fetchWithRetry<T>(url, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * PUT request
   */
  async put<T>(url: string, data?: unknown, options?: FetchOptions): Promise<T> {
    return fetchWithRetry<T>(url, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * PATCH request
   */
  async patch<T>(url: string, data?: unknown, options?: FetchOptions): Promise<T> {
    return fetchWithRetry<T>(url, {
      ...options,
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    })
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string, options?: FetchOptions): Promise<T> {
    return fetchWithRetry<T>(url, { ...options, method: "DELETE" })
  },
}

// ==================== Query Helpers ====================

/**
 * Build query string from params object
 */
export function buildQueryString(params: Record<string, string | number | boolean | undefined | null>): string {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      searchParams.set(key, String(value))
    }
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ""
}

/**
 * Parse API error for display
 */
export function parseApiError(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return "An unexpected error occurred"
}

// ==================== Domain-Specific API Functions ====================

/**
 * Content Items API
 */
export const contentApi = {
  async getItems(params: {
    workspaceId: string
    poolId?: string
    search?: string
    statusFilter?: string
    limit?: number
    cursor?: string
  }): Promise<PaginatedResponse<unknown>> {
    const query = buildQueryString(params)
    return api.get(`/api/pools/items${query}`)
  },

  async getItem(id: string): Promise<unknown> {
    return api.get(`/api/content-items/${id}`)
  },

  async deleteItem(id: string): Promise<void> {
    return api.delete(`/api/content-items/${id}`)
  },

  async batchAction(action: string, itemIds: string[], data?: unknown): Promise<unknown> {
    return api.post("/api/pools/items", { action, itemIds, data })
  },
}

/**
 * Jobs API
 */
export const jobsApi = {
  async getJobs(params: {
    workspaceId: string
    type?: string
    status?: string
    limit?: number
    cursor?: string
  }): Promise<PaginatedResponse<unknown>> {
    const query = buildQueryString(params)
    return api.get(`/api/jobs${query}`)
  },

  async getJob(id: string): Promise<unknown> {
    return api.get(`/api/jobs/${id}`)
  },

  async cancelJob(id: string): Promise<unknown> {
    return api.post(`/api/jobs/${id}/cancel`)
  },
}

/**
 * Dashboard API
 */
export const dashboardApi = {
  async getData(): Promise<unknown> {
    return api.get("/api/dashboard")
  },
}

/**
 * Workspaces API
 */
export const workspacesApi = {
  async getWorkspaces(): Promise<unknown[]> {
    const response = await api.get<{ workspaces: unknown[] }>("/api/workspaces")
    return response.workspaces || []
  },

  async getWorkspace(id: string): Promise<unknown> {
    return api.get(`/api/workspaces/${id}`)
  },
}
