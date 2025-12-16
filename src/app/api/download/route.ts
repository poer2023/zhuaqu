"use server"

import { NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
    const url = request.nextUrl.searchParams.get("url")
    const filename = request.nextUrl.searchParams.get("filename") || "download"

    if (!url) {
        return NextResponse.json({ error: "URL is required" }, { status: 400 })
    }

    try {
        // Fetch the file from the external URL
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
                "Referer": "https://x.com/",
            },
        })

        if (!response.ok) {
            return NextResponse.json(
                { error: `Failed to fetch: ${response.status}` },
                { status: response.status }
            )
        }

        const contentType = response.headers.get("content-type") || "application/octet-stream"
        const data = await response.arrayBuffer()

        // Determine file extension from URL or content type
        let ext = ""
        try {
            const urlPath = new URL(url).pathname
            const urlExt = urlPath.split(".").pop()?.toLowerCase()

            if (urlExt && ["mp4", "jpg", "jpeg", "png", "webp", "gif", "m4v", "mov"].includes(urlExt)) {
                ext = `.${urlExt}`
            }
        } catch { }

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
        let finalFilename = filename
        if (!finalFilename.includes(".") && ext) {
            finalFilename = `${filename}${ext}`
        }

        // Use RFC 5987 encoding for UTF-8 filenames
        const encodedFilename = encodeURIComponent(finalFilename).replace(/['()]/g, escape)

        return new NextResponse(data, {
            headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${finalFilename}"; filename*=UTF-8''${encodedFilename}`,
                "Content-Length": String(data.byteLength),
                "Cache-Control": "no-cache",
            },
        })
    } catch (error) {
        console.error("Download proxy error:", error)
        return NextResponse.json(
            { error: "Failed to download file" },
            { status: 500 }
        )
    }
}
