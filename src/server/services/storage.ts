import { mkdir, writeFile } from "fs/promises"
import path from "path"

export interface StorageResult {
    success: boolean
    localPath?: string
    publicUrl?: string
    error?: string
}

/**
 * Download media from URL and save to local public directory
 */
export async function downloadMedia(
    url: string,
    workspaceId: string,
    contentItemId: string,
    filename?: string
): Promise<StorageResult> {
    try {
        // Extract filename from URL if not provided
        const urlObj = new URL(url)
        const extractedFilename = filename || path.basename(urlObj.pathname) || `media_${Date.now()}`

        // Ensure filename has extension
        const finalFilename = extractedFilename.includes(".")
            ? extractedFilename
            : `${extractedFilename}.jpg`

        // Create directory structure: public/media/{workspaceId}/{contentItemId}/
        const relativePath = path.join("media", workspaceId, contentItemId)
        const absoluteDir = path.join(process.cwd(), "public", relativePath)

        await mkdir(absoluteDir, { recursive: true })

        // Download file
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; MediaDownloader/1.0)",
            },
        })

        if (!response.ok) {
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`,
            }
        }

        const buffer = Buffer.from(await response.arrayBuffer())

        // Save to disk
        const filePath = path.join(absoluteDir, finalFilename)
        await writeFile(filePath, buffer)

        // Return public URL (relative to /public)
        const publicUrl = `/${relativePath}/${finalFilename}`

        return {
            success: true,
            localPath: filePath,
            publicUrl,
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error),
        }
    }
}

/**
 * Download multiple media files
 */
export async function downloadMediaBatch(
    urls: string[],
    workspaceId: string,
    contentItemId: string
): Promise<Map<string, StorageResult>> {
    const results = new Map<string, StorageResult>()

    for (const url of urls) {
        const result = await downloadMedia(url, workspaceId, contentItemId)
        results.set(url, result)
    }

    return results
}
