import prisma from "@/lib/prisma"
import { AppError } from "@/server/errors"
import { markStepSucceeded } from "@/server/orchestrator/orchestrator"
import { appendStepLog } from "@/server/orchestrator/stepEvents"

// ==================== Types ====================

type Job = { id: string; type: string; status: string; workspaceId: string; poolId: string | null }
type Step = { id: string; type: string; job: Job; inputRef: unknown; attemptCount: number; maxAttempts: number }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JsonValue = any

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null
}

// ==================== QA Configuration ====================

interface QAConfig {
    minLength?: number
    maxLength?: number
    sensitiveWords?: string[]
    similarityThreshold?: number
}

const DEFAULT_QA_CONFIG: QAConfig = {
    minLength: 10,
    maxLength: 280, // Twitter limit
    sensitiveWords: [], // 可配置
    similarityThreshold: 0.8,
}

// ==================== QA Checks ====================

function checkLength(text: string, config: QAConfig): { passed: boolean; warning?: string } {
    if (config.minLength && text.length < config.minLength) {
        return { passed: false, warning: `Content too short: ${text.length} < ${config.minLength}` }
    }
    if (config.maxLength && text.length > config.maxLength) {
        return { passed: false, warning: `Content too long: ${text.length} > ${config.maxLength}` }
    }
    return { passed: true }
}

function checkSensitiveWords(text: string, config: QAConfig): { passed: boolean; warning?: string; matches?: string[] } {
    if (!config.sensitiveWords || config.sensitiveWords.length === 0) {
        return { passed: true }
    }

    const matches: string[] = []
    const lowerText = text.toLowerCase()

    for (const word of config.sensitiveWords) {
        if (lowerText.includes(word.toLowerCase())) {
            matches.push(word)
        }
    }

    if (matches.length > 0) {
        return { passed: false, warning: `Contains sensitive words: ${matches.join(", ")}`, matches }
    }
    return { passed: true }
}

// ==================== QA Handler ====================

export async function handleQAStep(step: Step & { job: Job }): Promise<void> {
    const supportedJobTypes = ["REWRITE", "PIPELINE"]
    if (!supportedJobTypes.includes(step.job.type)) {
        throw new AppError("STEP_NOT_SUPPORTED", `Invalid job type for QA: ${step.job.type}`)
    }

    const input = isRecord(step.inputRef) ? step.inputRef : {}
    const rewriteVersionIds = Array.isArray(input.rewriteVersionIds)
        ? input.rewriteVersionIds as string[]
        : []
    const config: QAConfig = {
        ...DEFAULT_QA_CONFIG,
        ...(isRecord(input.config) ? input.config : {}),
    }

    await appendStepLog(step.id, `Starting QA for ${rewriteVersionIds.length} rewrite versions`)

    const results: Array<{
        versionId: string
        passed: boolean
        warnings: string[]
        needsRework: boolean
    }> = []

    for (const versionId of rewriteVersionIds) {
        const version = await prisma.rewriteVersion.findUnique({
            where: { id: versionId },
            select: { id: true, output: true, status: true },
        })

        if (!version) {
            await appendStepLog(step.id, `Version ${versionId} not found`, "warn")
            continue
        }

        const output = version.output as { text?: string } | null
        const text = output?.text || ""
        const warnings: string[] = []
        let needsRework = false

        // Length check
        const lengthCheck = checkLength(text, config)
        if (!lengthCheck.passed && lengthCheck.warning) {
            warnings.push(lengthCheck.warning)
            needsRework = true
        }

        // Sensitive words check
        const sensitiveCheck = checkSensitiveWords(text, config)
        if (!sensitiveCheck.passed && sensitiveCheck.warning) {
            warnings.push(sensitiveCheck.warning)
            needsRework = true
        }

        // Update version if needs rework
        if (needsRework) {
            await prisma.rewriteVersion.update({
                where: { id: versionId },
                data: {
                    status: "DRAFTING", // Mark for rework
                    // 可以添加 qaWarnings 字段
                },
            })
            await appendStepLog(step.id, `Version ${versionId} marked for rework: ${warnings.join("; ")}`, "warn")
        } else {
            await appendStepLog(step.id, `Version ${versionId} passed QA`)
        }

        results.push({
            versionId,
            passed: !needsRework,
            warnings,
            needsRework,
        })
    }

    const passed = results.filter((r) => r.passed).length
    const failed = results.filter((r) => !r.passed).length

    await markStepSucceeded(step.id, {
        total: results.length,
        passed,
        failed,
        results,
    } as JsonValue)
}
