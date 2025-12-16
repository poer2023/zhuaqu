import { execFile, spawn } from "node:child_process"
import { promisify } from "node:util"
import path from "node:path"
import { createReadStream } from "node:fs"
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises"
import crypto from "node:crypto"

import { AppError } from "@/server/errors"

const execFileAsync = promisify(execFile)

export type YtDlpJson = Record<string, unknown>

function ytDlpCommonArgs(): string[] {
  const args: string[] = ["--no-warnings", "--no-playlist"]

  const cookiesFile = process.env.YTDLP_COOKIES?.trim()
  if (cookiesFile) args.push("--cookies", cookiesFile)

  const proxy = process.env.YTDLP_PROXY?.trim()
  if (proxy) args.push("--proxy", proxy)

  const userAgent = process.env.YTDLP_USER_AGENT?.trim()
  if (userAgent) args.push("--user-agent", userAgent)

  return args
}

export async function ytDlpJson(url: string): Promise<YtDlpJson> {
  try {
    const { stdout } = await execFileAsync(
      "yt-dlp",
      ["-J", "--ignore-no-formats-error", ...ytDlpCommonArgs(), url],
      { maxBuffer: 1024 * 1024 * 50 }
    )
    const parsed = JSON.parse(stdout) as YtDlpJson
    return parsed
  } catch (error) {
    const err = error as NodeJS.ErrnoException
    if (err.code === "ENOENT") {
      throw new AppError(
        "YTDLP_NOT_INSTALLED",
        "yt-dlp not found in PATH. Install it (macOS: `brew install yt-dlp`, Ubuntu: `sudo apt install yt-dlp`).",
        error
      )
    }
    throw new AppError("YTDLP_FAILED", `yt-dlp failed for url: ${url}`, error)
  }
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    const s = await stat(filePath)
    return s.isFile()
  } catch {
    return false
  }
}

async function sha256File(filePath: string): Promise<{ bytes: number; sha256: string }> {
  const s = await stat(filePath)
  const hash = crypto.createHash("sha256")
  const stream = createReadStream(filePath)
  for await (const chunk of stream) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    hash.update(buf)
  }
  return { bytes: s.size, sha256: hash.digest("hex") }
}

async function runYtDlpCommand(args: string[], timeoutMs: number): Promise<void> {
  const stderrChunks: Buffer[] = []
  const stdoutChunks: Buffer[] = []
  let stderrBytes = 0
  let stdoutBytes = 0
  const maxCaptureBytes = 1024 * 1024 * 2

  await new Promise<void>((resolve, reject) => {
    const child = spawn("yt-dlp", args, { stdio: ["ignore", "pipe", "pipe"] })

    const killTimer = setTimeout(() => {
      child.kill("SIGKILL")
      reject(new AppError("YTDLP_TIMEOUT", `yt-dlp timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.on("error", (error) => {
      clearTimeout(killTimer)
      const err = error as NodeJS.ErrnoException
      if (err.code === "ENOENT") {
        reject(
          new AppError(
            "YTDLP_NOT_INSTALLED",
            "yt-dlp not found in PATH. Install it (macOS: `brew install yt-dlp`, Ubuntu: `sudo apt install yt-dlp`).",
            error
          )
        )
        return
      }
      reject(new AppError("YTDLP_FAILED", "yt-dlp failed to start", error))
    })

    child.stdout.on("data", (chunk: Buffer) => {
      if (stdoutBytes >= maxCaptureBytes) return
      stdoutBytes += chunk.length
      stdoutChunks.push(chunk)
    })
    child.stderr.on("data", (chunk: Buffer) => {
      if (stderrBytes >= maxCaptureBytes) return
      stderrBytes += chunk.length
      stderrChunks.push(chunk)
    })

    child.on("close", (code) => {
      clearTimeout(killTimer)
      if (code === 0) return resolve()

      const stdout = Buffer.concat(stdoutChunks).toString("utf8")
      const stderr = Buffer.concat(stderrChunks).toString("utf8")
      reject(
        new AppError(
          "YTDLP_FAILED",
          `yt-dlp exited with code ${code}. ${stderr || stdout || "No output"}`.slice(0, 4000)
        )
      )
    })
  })
}

export async function ytDlpDownloadMp4(
  url: string,
  filePath: string,
  opts?: { timeoutMs?: number; overwrite?: boolean }
): Promise<{ bytes: number; sha256: string }> {
  const timeoutMs = opts?.timeoutMs ?? 10 * 60_000
  const overwrite = opts?.overwrite ?? false

  if (!overwrite && (await fileExists(filePath))) {
    throw new AppError("FILE_EXISTS", `File already exists: ${filePath}`)
  }

  await mkdir(path.dirname(filePath), { recursive: true })
  if (overwrite) {
    await rm(filePath, { force: true }).catch(() => undefined)
    await rm(`${filePath}.part`, { force: true }).catch(() => undefined)
  }

  const outputTemplate = filePath.endsWith(".mp4") ? filePath.replace(/\.mp4$/, ".%(ext)s") : `${filePath}.%(ext)s`
  const args = [
    ...ytDlpCommonArgs(),
    "--no-progress",
    "--retries",
    "3",
    "--fragment-retries",
    "3",
    "-f",
    "bv*+ba/b",
    "--merge-output-format",
    "mp4",
    "--remux-video",
    "mp4",
    "-o",
    outputTemplate,
    url,
  ]

  await runYtDlpCommand(args, timeoutMs)

  if (!(await fileExists(filePath))) {
    const dir = path.dirname(filePath)
    const base = path.basename(filePath, path.extname(filePath))
    const candidates = (await readdir(dir)).filter((name) => name.startsWith(`${base}.`) && !name.endsWith(".part"))
    if (candidates.length === 1) {
      await rename(path.join(dir, candidates[0]), filePath)
    }
  }

  if (!(await fileExists(filePath))) {
    throw new AppError("YTDLP_OUTPUT_MISSING", `yt-dlp did not produce expected file: ${filePath}`)
  }

  return sha256File(filePath)
}

type YtDlpFormat = {
  url?: string
  format_id?: string
  ext?: string
  protocol?: string
  vcodec?: string
  acodec?: string
  height?: number
  width?: number
  tbr?: number
  filesize?: number
  filesize_approx?: number
}

export type ExtractedVideoVariant = {
  url: string
  formatId: string | null
  ext: string | null
  protocol: string | null
  width: number | null
  height: number | null
  tbr: number | null
  filesize: number | null
  vcodec: string | null
  acodec: string | null
}

export type ExtractedTweet = {
  authorHandle: string | null
  authorName: string | null
  authorAvatar: string | null
  text: string
  raw: YtDlpJson
  videoVariants: ExtractedVideoVariant[]
  bestVideo: ExtractedVideoVariant | null
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null
}

function decodeHtmlEntities(input: string): string {
  const named: Record<string, string> = {
    "&amp;": "&",
    "&lt;": "<",
    "&gt;": ">",
    "&quot;": "\"",
    "&#39;": "'",
    "&nbsp;": " ",
  }

  return input
    .replace(/&(amp|lt|gt|quot|nbsp);|&#39;/g, (m) => named[m] ?? m)
    .replace(/&#(\d+);/g, (_m, dec) => {
      const codePoint = Number.parseInt(dec, 10)
      if (!Number.isFinite(codePoint)) return _m
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return _m
      }
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => {
      const codePoint = Number.parseInt(hex, 16)
      if (!Number.isFinite(codePoint)) return _m
      try {
        return String.fromCodePoint(codePoint)
      } catch {
        return _m
      }
    })
}

function normalizeYtDlpPayload(raw: YtDlpJson): YtDlpJson {
  const entries = raw.entries
  if (Array.isArray(entries) && entries.length > 0 && typeof entries[0] === "object" && entries[0] !== null) {
    return entries[0] as YtDlpJson
  }
  return raw
}

export function extractTweetFromYtDlp(rawInput: YtDlpJson): ExtractedTweet {
  const raw = rawInput
  const payload = normalizeYtDlpPayload(rawInput)

  const description = asString(payload.description) ?? ""
  const title = asString(payload.title) ?? ""
  const text = decodeHtmlEntities(description).trim() || decodeHtmlEntities(title).trim() || ""

  const uploaderIdRaw = asString(payload.uploader_id)
  const authorHandle = uploaderIdRaw ? uploaderIdRaw.replace(/^@/, "") : null
  const authorName = asString(payload.uploader) ?? null
  const authorAvatar = asString(payload.uploader_avatar) ?? asString(payload.thumbnail) ?? null

  const formatsRaw = Array.isArray(payload.formats) ? (payload.formats as unknown[]) : []
  const formats: YtDlpFormat[] = formatsRaw.filter((f): f is YtDlpFormat => typeof f === "object" && f !== null)

  const variants: ExtractedVideoVariant[] = formats
    .filter((f) => typeof f.url === "string" && f.url.length > 0)
    .map((f) => ({
      url: f.url!,
      formatId: f.format_id ?? null,
      ext: f.ext ?? null,
      protocol: f.protocol ?? null,
      width: typeof f.width === "number" ? f.width : null,
      height: typeof f.height === "number" ? f.height : null,
      tbr: typeof f.tbr === "number" ? f.tbr : null,
      filesize: typeof f.filesize === "number" ? f.filesize : typeof f.filesize_approx === "number" ? f.filesize_approx : null,
      vcodec: f.vcodec ?? null,
      acodec: f.acodec ?? null,
    }))

  const mp4Variants = variants.filter((v) => v.ext === "mp4" && v.vcodec && v.vcodec !== "none")
  mp4Variants.sort((a, b) => {
    const aHasAudio = Boolean(a.acodec && a.acodec !== "none")
    const bHasAudio = Boolean(b.acodec && b.acodec !== "none")
    if (aHasAudio !== bHasAudio) return aHasAudio ? -1 : 1
    return (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0)
  })
  const bestMp4 = mp4Variants[0] ?? null

  const bestFallback = variants
    .filter((v) => v.protocol?.includes("m3u8") || v.ext === "m3u8")
    .sort((a, b) => (b.height ?? 0) - (a.height ?? 0) || (b.tbr ?? 0) - (a.tbr ?? 0))[0] ?? null

  return {
    authorHandle,
    authorName,
    authorAvatar,
    text,
    raw,
    videoVariants: variants,
    bestVideo: bestMp4 ?? bestFallback,
  }
}
