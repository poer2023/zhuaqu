import type { Prisma } from "@prisma/client"

// ==================== Step Handler Types ====================

export type StepContext = {
    stepId: string
    jobId: string
    jobType: string
    workspaceId: string
    poolId: string | null
    inputRef: unknown
    attemptCount: number
    maxAttempts: number
}

export type StepResult = {
    status: "succeeded" | "failed" | "skipped"
    outputRef?: Prisma.InputJsonValue
    error?: Error
}

export type StepHandler = (ctx: StepContext) => Promise<StepResult>

// ==================== Handler Registry ====================

const handlers: Map<string, StepHandler> = new Map()

export function registerHandler(stepType: string, handler: StepHandler): void {
    handlers.set(stepType, handler)
}

export function getHandler(stepType: string): StepHandler | undefined {
    return handlers.get(stepType)
}

export function listHandlers(): string[] {
    return Array.from(handlers.keys())
}

// ==================== Optional Step Definitions ====================

export type StepDefinition = {
    type: string
    name: string
    description: string
    requiredJobTypes: string[]
    dependsOn?: string[] // Step types this depends on
    optional: boolean
}

export const STEP_DEFINITIONS: StepDefinition[] = [
    {
        type: "CAPTURE",
        name: "Capture",
        description: "Capture content from URL or sync source",
        requiredJobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE"],
        optional: false,
    },
    {
        type: "EXTRACT",
        name: "Extract",
        description: "Extract and clean content, generate summaries",
        requiredJobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"],
        dependsOn: ["CAPTURE"],
        optional: true,
    },
    {
        type: "MEDIA",
        name: "Media",
        description: "Download and process media files (images, videos)",
        requiredJobTypes: ["INGEST_URL", "SYNC_LIKES", "SYNC_BOOKMARKS", "SYNC_TIMELINE", "PIPELINE"],
        dependsOn: ["CAPTURE"],
        optional: true,
    },
    {
        type: "REWRITE",
        name: "Rewrite",
        description: "AI-powered content rewriting",
        requiredJobTypes: ["REWRITE", "PIPELINE"],
        dependsOn: ["CAPTURE", "EXTRACT"],
        optional: false,
    },
    {
        type: "QA",
        name: "QA",
        description: "Quality assurance checks (length, sensitive words, similarity)",
        requiredJobTypes: ["REWRITE", "PIPELINE"],
        dependsOn: ["REWRITE"],
        optional: true,
    },
    {
        type: "SCHEDULE",
        name: "Schedule",
        description: "Schedule content for publishing",
        requiredJobTypes: ["PUBLISH", "PIPELINE"],
        dependsOn: ["REWRITE", "QA"],
        optional: true,
    },
    {
        type: "PUBLISH",
        name: "Publish",
        description: "Publish content to social platforms",
        requiredJobTypes: ["PUBLISH", "PIPELINE"],
        dependsOn: ["REWRITE", "QA", "SCHEDULE"],
        optional: false,
    },
]

export function getStepDefinition(stepType: string): StepDefinition | undefined {
    return STEP_DEFINITIONS.find((d) => d.type === stepType)
}
