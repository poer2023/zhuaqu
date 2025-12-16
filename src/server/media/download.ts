import { createWriteStream } from "node:fs"
import { mkdir, rename, rm, stat } from "node:fs/promises"
import path from "node:path"
import crypto from "node:crypto"
import { Readable, Transform } from "node:stream"
import { pipeline } from "node:stream/promises"
import type { ReadableStream as NodeReadableStream } from "node:stream/web"

import { AppError } from "@/server/errors"

export type DownloadResult = {
  bytes: number
  sha256: string
}

async function sleep(ms: number): Promise<void> {
  await new Promise((r) => setTimeout(r, ms))
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile()
  } catch {
    return false
  }
}

export async function downloadToFile(url: string, filePath: string, opts?: { timeoutMs?: number; overwrite?: boolean }): Promise<DownloadResult> {
  const timeoutMs = opts?.timeoutMs ?? 120_000
  const overwrite = opts?.overwrite ?? false

  if (!overwrite && (await fileExists(filePath))) {
    throw new AppError("FILE_EXISTS", `File already exists: ${filePath}`)
  }

  await mkdir(path.dirname(filePath), { recursive: true })

  const attempts = 3
  let lastError: unknown

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const tmpPath = `${filePath}.tmp`
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
      const res = await fetch(url, {
        redirect: "follow",
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "*/*",
        },
      })

      if (!res.ok || !res.body) {
        throw new AppError("DOWNLOAD_HTTP_ERROR", `Download failed: ${res.status} ${res.statusText} (${url})`)
      }

      let bytes = 0
      const hash = crypto.createHash("sha256")
      const hasher = new Transform({
        transform(chunk, _enc, cb) {
          const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
          bytes += buf.length
          hash.update(buf)
          cb(null, buf)
        },
      })

      const body = Readable.fromWeb(res.body as unknown as NodeReadableStream<Uint8Array>)
      await pipeline(body, hasher, createWriteStream(tmpPath))
      await rename(tmpPath, filePath)

      return { bytes, sha256: hash.digest("hex") }
    } catch (error) {
      lastError = error
      await rm(tmpPath, { force: true }).catch(() => undefined)
      if (attempt < attempts) {
        await sleep(750 * attempt)
        continue
      }
      if (error instanceof AppError) throw error
      throw new AppError("DOWNLOAD_FAILED", `Download failed for ${url}`, error)
    } finally {
      clearTimeout(timeout)
    }
  }

  throw new AppError("DOWNLOAD_FAILED", `Download failed for ${url}`, lastError)
}
