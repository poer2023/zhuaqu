import path from "node:path"

export function getMediaDirAbs(): string {
  const configured = process.env.MEDIA_DIR?.trim()
  if (configured) return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured)
  return path.resolve(process.cwd(), "data", "media")
}

export function getContentItemMediaDirAbs(contentItemId: string): string {
  return path.join(getMediaDirAbs(), contentItemId)
}

export function getContentItemVideoPathAbs(contentItemId: string, index: number): string {
  return path.join(getContentItemMediaDirAbs(contentItemId), `video_${index}.mp4`)
}

export function toProjectRelativePath(absPath: string): string {
  return path.relative(process.cwd(), absPath)
}

export function resolveProjectPath(relPath: string): string {
  return path.resolve(process.cwd(), relPath)
}

