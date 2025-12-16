import { GoogleGenAI } from "@google/genai"
import { z } from "zod"

import { AppError, getErrorMessage } from "@/server/errors"

const ThreadDraftSchema = z.object({
  thread_title: z.string().min(1),
  tweets: z.array(z.object({ index: z.number().int().positive(), text: z.string().min(1) })).min(1),
  hashtags: z.array(z.string()).default([]),
  claims_to_verify: z.array(z.string()).default([]),
  source_urls: z.array(z.string()).default([]),
})

export type ThreadDraft = z.infer<typeof ThreadDraftSchema>

function extractJsonObject(text: string): string {
  const start = text.indexOf("{")
  const end = text.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) {
    throw new AppError("GEMINI_BAD_OUTPUT", "Gemini did not return JSON")
  }
  return text.slice(start, end + 1)
}

async function waitForFileActive(ai: GoogleGenAI, fileName: string, timeoutMs = 120_000): Promise<void> {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    const file = await ai.files.get({ name: fileName })
    if (file.state === "ACTIVE") return
    if (file.state === "FAILED") throw new AppError("GEMINI_FILE_FAILED", "Gemini file processing failed")
    await new Promise((r) => setTimeout(r, 1500))
  }
  throw new AppError("GEMINI_FILE_TIMEOUT", "Timed out waiting for Gemini file processing")
}

export async function generateThreadFromVideo(args: {
  videoPath: string
  sourceUrl?: string
  authorHandle?: string
  originalText?: string
  maxTweets?: number
  language?: "zh" | "en"
}): Promise<ThreadDraft> {
  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return {
      thread_title: "（示例）视频要点拆解",
      tweets: [
        { index: 1, text: "我看完这段视频，核心就一句话：先抓住关键变量，再谈方法论。" },
        { index: 2, text: "1) 这段视频在讲什么？用一句话复述它的主张（而不是复述画面）。" },
        { index: 3, text: "2) 它的论据是什么？哪些是事实、哪些是观点、哪些只是情绪表达？" },
        { index: 4, text: "3) 可迁移的结论：你能把它落到自己的场景里吗？给出 1 个行动建议。" },
      ],
      hashtags: [],
      claims_to_verify: [],
      source_urls: args.sourceUrl ? [args.sourceUrl] : [],
    }
  }

  const model = process.env.GEMINI_MODEL?.trim() || "gemini-2.5-flash"
  const maxTweets = args.maxTweets ?? 7
  const language = args.language ?? "zh"

  const ai = new GoogleGenAI({ apiKey })

  try {
    const file = await ai.files.upload({
      file: args.videoPath,
      config: { mimeType: "video/mp4", displayName: "source-video" },
    })

    if (!file.name || !file.uri) throw new AppError("GEMINI_UPLOAD_FAILED", "Gemini file upload failed")
    await waitForFileActive(ai, file.name)

    const prompt = [
      `你是一位资深内容编辑，擅长把视频内容改写成可以直接发布到 X 的“线程（thread）”。`,
      `要求：`,
      `- 输出语言：${language === "zh" ? "中文" : "英文"}`,
      `- 必须“重写观点”，不能逐句复述字幕；要有结构、有立场、有结论、有可执行建议`,
      `- 线程长度：最多 ${maxTweets} 条（尽量 5~7 条）`,
      `- 每条推文尽量短、有信息密度，避免模板化口水`,
      `- 如果视频里出现具体数据/结论但你无法确认真实性，请放入 claims_to_verify`,
      `- 必须输出严格 JSON（不要 Markdown、不要代码块、不要额外解释）`,
      ``,
      `JSON schema:`,
      `{`,
      `  "thread_title": string,`,
      `  "tweets": [{"index": number, "text": string}],`,
      `  "hashtags": string[],`,
      `  "claims_to_verify": string[],`,
      `  "source_urls": string[]`,
      `}`,
      ``,
      args.sourceUrl ? `source_urls 至少包含：${args.sourceUrl}` : `source_urls 可为空数组`,
      args.authorHandle ? `原作者：@${args.authorHandle}` : ``,
      args.originalText ? `原推文文本（供参考，不能照抄）：${args.originalText}` : ``,
    ]
      .filter(Boolean)
      .join("\n")

    const response = await ai.models.generateContent({
      model,
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            { fileData: { mimeType: "video/mp4", fileUri: file.uri } },
          ],
        },
      ],
    })

    const rawText = response.text ?? ""
    const jsonText = extractJsonObject(rawText)
    const parsed = ThreadDraftSchema.safeParse(JSON.parse(jsonText))
    if (!parsed.success) {
      throw new AppError("GEMINI_BAD_OUTPUT", `Gemini JSON schema mismatch: ${parsed.error.message}`)
    }
    return parsed.data
  } catch (error) {
    throw new AppError("GEMINI_FAILED", `Gemini failed: ${getErrorMessage(error)}`, error)
  }
}

