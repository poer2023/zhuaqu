"use client"

import { useState, useCallback, useRef, useEffect } from "react"

interface SSEStreamOptions {
    url: string
    method?: "GET" | "POST"
    body?: Record<string, unknown>
    headers?: Record<string, string>
    onMessage?: (data: unknown) => void
    onError?: (error: Error) => void
    onComplete?: () => void
    maxRetries?: number
    initialRetryDelay?: number
    maxRetryDelay?: number
}

interface SSEStreamState {
    isConnecting: boolean
    isStreaming: boolean
    error: Error | null
    retryCount: number
    streamedText: string
}

/**
 * SSE Stream hook with exponential backoff reconnection
 *
 * Features:
 * - Automatic reconnection with exponential backoff
 * - Configurable max retries and delays
 * - Abort on unmount
 * - Resume capability (via lastEventId)
 */
export function useSSEStream() {
    const [state, setState] = useState<SSEStreamState>({
        isConnecting: false,
        isStreaming: false,
        error: null,
        retryCount: 0,
        streamedText: "",
    })

    const abortControllerRef = useRef<AbortController | null>(null)
    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const lastEventIdRef = useRef<string | null>(null)

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort()
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current)
            }
        }
    }, [])

    const calculateRetryDelay = useCallback((
        retryCount: number,
        initialDelay: number,
        maxDelay: number
    ) => {
        // Exponential backoff with jitter
        const exponentialDelay = initialDelay * Math.pow(2, retryCount)
        const jitter = Math.random() * 0.3 * exponentialDelay // 30% jitter
        return Math.min(exponentialDelay + jitter, maxDelay)
    }, [])

    const stream = useCallback(async (options: SSEStreamOptions) => {
        const {
            url,
            method = "POST",
            body,
            headers = {},
            onMessage,
            onError,
            onComplete,
            maxRetries = 3,
            initialRetryDelay = 1000,
            maxRetryDelay = 30000,
        } = options

        // Abort any existing request
        abortControllerRef.current?.abort()
        abortControllerRef.current = new AbortController()

        setState(prev => ({
            ...prev,
            isConnecting: true,
            isStreaming: false,
            error: null,
            streamedText: "",
        }))

        const attemptConnection = async (retryCount: number): Promise<void> => {
            try {
                const requestHeaders: Record<string, string> = {
                    "Content-Type": "application/json",
                    ...headers,
                }

                // Include last event ID for resume capability
                if (lastEventIdRef.current) {
                    requestHeaders["Last-Event-ID"] = lastEventIdRef.current
                }

                const response = await fetch(url, {
                    method,
                    headers: requestHeaders,
                    body: body ? JSON.stringify(body) : undefined,
                    signal: abortControllerRef.current?.signal,
                })

                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
                }

                if (!response.body) {
                    throw new Error("No response body")
                }

                setState(prev => ({
                    ...prev,
                    isConnecting: false,
                    isStreaming: true,
                    retryCount: 0,
                }))

                const reader = response.body.getReader()
                const decoder = new TextDecoder()
                let fullText = ""

                while (true) {
                    const { done, value } = await reader.read()

                    if (done) {
                        setState(prev => ({ ...prev, isStreaming: false }))
                        onComplete?.()
                        break
                    }

                    const chunk = decoder.decode(value, { stream: true })
                    const lines = chunk.split("\n\n")

                    for (const line of lines) {
                        if (line.startsWith("data: ")) {
                            try {
                                const data = JSON.parse(line.slice(6))

                                // Track event ID for resume
                                if (data.id) {
                                    lastEventIdRef.current = data.id
                                }

                                // Handle content
                                if (data.content) {
                                    fullText += data.content
                                    setState(prev => ({ ...prev, streamedText: fullText }))
                                }

                                onMessage?.(data)

                                if (data.done) {
                                    setState(prev => ({ ...prev, isStreaming: false }))
                                    onComplete?.()
                                    return
                                }

                                if (data.error) {
                                    throw new Error(data.error)
                                }
                            } catch (parseError) {
                                // Skip invalid JSON lines
                                if (line.trim() && !line.includes("[DONE]")) {
                                    console.warn("Failed to parse SSE data:", line)
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                // Don't retry if aborted
                if (error instanceof Error && error.name === "AbortError") {
                    setState(prev => ({
                        ...prev,
                        isConnecting: false,
                        isStreaming: false,
                    }))
                    return
                }

                const err = error instanceof Error ? error : new Error(String(error))

                // Check if we should retry
                if (retryCount < maxRetries) {
                    const delay = calculateRetryDelay(retryCount, initialRetryDelay, maxRetryDelay)

                    console.log(`SSE connection failed, retrying in ${Math.round(delay)}ms (attempt ${retryCount + 1}/${maxRetries})`)

                    setState(prev => ({
                        ...prev,
                        isConnecting: true,
                        isStreaming: false,
                        retryCount: retryCount + 1,
                    }))

                    retryTimeoutRef.current = setTimeout(() => {
                        attemptConnection(retryCount + 1)
                    }, delay)
                } else {
                    // Max retries exceeded
                    setState(prev => ({
                        ...prev,
                        isConnecting: false,
                        isStreaming: false,
                        error: err,
                    }))
                    onError?.(err)
                }
            }
        }

        await attemptConnection(0)
    }, [calculateRetryDelay])

    const abort = useCallback(() => {
        abortControllerRef.current?.abort()
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current)
        }
        setState(prev => ({
            ...prev,
            isConnecting: false,
            isStreaming: false,
        }))
    }, [])

    const reset = useCallback(() => {
        abort()
        lastEventIdRef.current = null
        setState({
            isConnecting: false,
            isStreaming: false,
            error: null,
            retryCount: 0,
            streamedText: "",
        })
    }, [abort])

    return {
        ...state,
        stream,
        abort,
        reset,
    }
}
