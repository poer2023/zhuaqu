"use server"

import { NextRequest, NextResponse } from "next/server"

// ==================== Security Configuration ====================

// OPT-H1: Domain whitelist - only allow trusted media hosts
const ALLOWED_HOSTS = new Set([
    "pbs.twimg.com",
    "video.twimg.com",
    "ton.twimg.com",
    "abs.twimg.com",
    "platform.twitter.com",
    // Add other trusted hosts as needed
])

// Maximum file size (100MB)
const MAX_SIZE_BYTES = 100 * 1024 * 1024

// OPT-H1: Block private/internal IP addresses to prevent SSRF
function isPrivateOrLocalhost(hostname: string): boolean {
    // Localhost variants
    if (hostname === "localhost" || hostname === "[::1]") return true

    // Check for IP address patterns
    const ipv4Match = hostname.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/)
    if (ipv4Match) {
        const [, a, b, _c] = ipv4Match.map(Number)
        // 127.x.x.x (loopback)
        if (a === 127) return true
        // 10.x.x.x (private)
        if (a === 10) return true
        // 172.16-31.x.x (private)
        if (a === 172 && b >= 16 && b <= 31) return true
        // 192.168.x.x (private)
        if (a === 192 && b === 168) return true
        // 169.254.x.x (link-local)
        if (a === 169 && b === 254) return true
        // 0.x.x.x (reserved)
        if (a === 0) return true
    }

    // IPv6 private/local patterns
    if (hostname.startsWith("[")) {
        const ipv6 = hostname.slice(1, -1).toLowerCase()
        if (ipv6.startsWith("fe80:") || ipv6.startsWith("fc") || ipv6.startsWith("fd")) {
            return true
        }
    }

    return false
}

function validateUrl(urlStr: string): { valid: boolean; error?: string; parsedUrl?: URL } {
    let parsedUrl: URL
    try {
        parsedUrl = new URL(urlStr)
    } catch {
        return { valid: false, error: "Invalid URL format" }
    }

    // Only allow HTTPS (and HTTP for development)
    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
        return { valid: false, error: "Only HTTP/HTTPS URLs are allowed" }
    }

    // Block private/localhost addresses
    if (isPrivateOrLocalhost(parsedUrl.hostname)) {
        return { valid: false, error: "Access to internal addresses is forbidden" }
    }

    // Check against whitelist
    if (!ALLOWED_HOSTS.has(parsedUrl.hostname)) {
        return { valid: false, error: `Host not allowed: ${parsedUrl.hostname}` }
    }

    return { valid: true, parsedUrl }
}

function sanitizeFilename(input: string): string {
    const cleaned = input.replace(/[/\\]/g, "_").replace(/[\r\n"]/g, "").trim()
    return cleaned || "download"
}

// ==================== Main Handler ====================

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url")
    const filename = request.nextUrl.searchParams.get("filename") || "download"

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    // Validate URL security
    const validation = validateUrl(url)
    if (!validation.valid) {
        return NextResponse.json({ error: validation.error }, { status: 403 })
    }

    try {
        // Fetch with abort signal for timeout
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 30000) // 30s timeout

        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": "https://x.com/",
            },
            signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status}` },
                { status: response.status }
            )
        }

        // Check Content-Length before downloading
        const contentLengthHeader = response.headers.get("content-length")
        if (contentLengthHeader) {
            const contentLength = parseInt(contentLengthHeader, 10)
            if (contentLength > MAX_SIZE_BYTES) {
                return NextResponse.json(
                    { error: `File too large: ${Math.round(contentLength / 1024 / 1024)}MB exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB limit` },
                    { status: 413 }
                )
            }
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream"

        // Stream the response instead of loading entirely into memory
        if (!response.body) {
            return NextResponse.json({ error: "No response body" }, { status: 500 })
        }

        // Stream with size guard for responses without Content-Length
        let downloadedSize = 0
        const reader = response.body.getReader()
        const stream = new ReadableStream<Uint8Array>({
            async pull(controller) {
                const { done, value } = await reader.read()
                if (done) {
                    controller.close()
                    return
                }

                downloadedSize += value.length
                if (downloadedSize > MAX_SIZE_BYTES) {
                    await reader.cancel()
                    controller.error(new Error("File too large"))
                    return
                }

                controller.enqueue(value)
            },
            cancel() {
                reader.cancel().catch(() => undefined)
            },
        })

        // Determine file extension from URL or content type
        let ext = ""
        try {
            const urlPath = validation.parsedUrl!.pathname
            const urlExt = urlPath.split(".").pop()?.toLowerCase()

            if (urlExt && ["mp4", "jpg", "jpeg", "png", "webp", "gif", "m4v", "mov"].includes(urlExt)) {
                ext = `.${urlExt}`
            }
        } catch { /* ignore */ }

        if (!ext) {
            if (contentType.includes("video/mp4")) {
                ext = ".mp4"
            } else if (contentType.includes("image/jpeg") || contentType.includes("image/jpg")) {
                ext = ".jpg"
            } else if (contentType.includes("image/png")) {
                ext = ".png"
            } else if (contentType.includes("image/webp")) {
                ext = ".webp"
            } else if (contentType.includes("image/gif")) {
                ext = ".gif"
            }
        }

        // Build final filename
        let finalFilename = sanitizeFilename(filename)
        if (!finalFilename.includes(".") && ext) {
            finalFilename = `${finalFilename}${ext}`
        }

        // Use RFC 5987 encoding for UTF-8 filenames
        const encodedFilename = encodeURIComponent(finalFilename).replace(/['()]/g, escape)

        const headers: Record<string, string> = {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodedFilename}`,
            "Cache-Control": "no-store",
        }

        if (contentLengthHeader) {
            headers["Content-Length"] = contentLengthHeader
        }

        return new NextResponse(stream, { headers })
    } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json({ error: "Request timeout" }, { status: 504 })
        }
        console.error("Download proxy error:", error)
        return NextResponse.json(
            { error: "Failed to download file" },
            { status: 500 }
        )
    }
}
