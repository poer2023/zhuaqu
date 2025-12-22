
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "CaptureStatus" AS ENUM ('QUEUED', 'FETCHING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "RewriteStatus" AS ENUM ('NONE', 'DRAFTING', 'GENERATED', 'APPROVED', 'REWORK', 'REJECTED');

-- CreateEnum
CREATE TYPE "PublishStatus" AS ENUM ('NOT_PUBLISHED', 'QUEUED', 'PUBLISHED', 'FAILED', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'PARTIAL_FAILED');

-- CreateEnum
CREATE TYPE "OrchestratorJobType" AS ENUM ('INGEST_URL', 'SYNC_LIKES', 'SYNC_BOOKMARKS', 'SYNC_TIMELINE', 'REWRITE', 'PUBLISH', 'PIPELINE');

-- CreateEnum
CREATE TYPE "OrchestratorJobStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'FAILED', 'DONE', 'CANCELED');

-- CreateEnum
CREATE TYPE "OrchestratorStepType" AS ENUM ('CAPTURE', 'EXTRACT', 'MEDIA', 'REWRITE', 'QA', 'SCHEDULE', 'PUBLISH');

-- CreateEnum
CREATE TYPE "OrchestratorStepStatus" AS ENUM ('QUEUED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('INGEST_CREATED', 'INGEST_COMPLETED', 'INGEST_FAILED', 'REWRITE_CREATED', 'REWRITE_GENERATED', 'REWRITE_APPROVED', 'REWRITE_REJECTED', 'REWRITE_REWORK', 'PUBLISH_QUEUED', 'PUBLISH_SUCCEEDED', 'PUBLISH_FAILED', 'ITEM_MOVED', 'ITEM_DELETED', 'ITEM_TAGGED');

-- CreateEnum
CREATE TYPE "SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SyncSource" AS ENUM ('LIKES', 'BOOKMARKS', 'TIMELINE');

-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "defaultPoolId" TEXT,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pools" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pools_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "type" "OrchestratorJobType" NOT NULL,
    "status" "OrchestratorJobStatus" NOT NULL DEFAULT 'PENDING',
    "workspaceId" TEXT NOT NULL,
    "poolId" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "traceId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "steps" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" "OrchestratorStepType" NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "status" "OrchestratorStepStatus" NOT NULL DEFAULT 'QUEUED',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "heartbeatAt" TIMESTAMP(3),
    "dependsOnStepId" TEXT,
    "inputRef" JSONB NOT NULL DEFAULT '{}',
    "outputRef" JSONB NOT NULL DEFAULT '{}',
    "error" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "steps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "step_events" (
    "id" TEXT NOT NULL,
    "stepId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "step_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_items" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "jobId" TEXT,
    "sourceId" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "authorHandle" TEXT NOT NULL,
    "authorName" TEXT,
    "authorAvatar" TEXT,
    "textOriginal" TEXT NOT NULL,
    "lang" TEXT,
    "rawJson" JSONB NOT NULL,
    "media" JSONB NOT NULL DEFAULT '[]',
    "threadId" TEXT,
    "threadPosition" INTEGER,
    "captureStatus" "CaptureStatus" NOT NULL DEFAULT 'QUEUED',
    "rewriteStatus" "RewriteStatus" NOT NULL DEFAULT 'NONE',
    "publishStatus" "PublishStatus" NOT NULL DEFAULT 'NOT_PUBLISHED',
    "notes" TEXT,
    "isArchived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "content_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_item_tags" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_item_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ingest_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "jobId" TEXT,
    "urls" JSONB NOT NULL,
    "options" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "deduped" INTEGER NOT NULL DEFAULT 0,
    "failures" JSONB NOT NULL DEFAULT '[]',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ingest_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewrite_presets" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetPersona" TEXT,
    "audienceTone" TEXT,
    "stance" TEXT,
    "outputFormat" TEXT NOT NULL DEFAULT 'single',
    "includeHook" BOOLEAN NOT NULL DEFAULT true,
    "includeConclusion" BOOLEAN NOT NULL DEFAULT true,
    "includeCTA" BOOLEAN NOT NULL DEFAULT false,
    "requireFactCheck" BOOLEAN NOT NULL DEFAULT true,
    "includeSource" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'zh',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewrite_presets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewrite_batches" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "presetId" TEXT,
    "jobId" TEXT,
    "name" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "total" INTEGER NOT NULL DEFAULT 0,
    "succeeded" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewrite_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rewrite_versions" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "batchId" TEXT,
    "jobId" TEXT,
    "stepId" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "output" JSONB NOT NULL,
    "outputFormat" TEXT NOT NULL DEFAULT 'single',
    "paramsSnapshot" JSONB NOT NULL DEFAULT '{}',
    "status" "RewriteStatus" NOT NULL DEFAULT 'GENERATED',
    "charCount" INTEGER,
    "similarityScore" DOUBLE PRECISION,
    "warnings" JSONB NOT NULL DEFAULT '[]',
    "reviewedAt" TIMESTAMP(3),
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rewrite_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "x_accounts" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xUserId" TEXT NOT NULL,
    "xUsername" TEXT NOT NULL,
    "xDisplayName" TEXT,
    "xAvatar" TEXT,
    "accessToken" TEXT NOT NULL,
    "refreshToken" TEXT,
    "tokenExpiry" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "lastUsedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "x_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "xAccountId" TEXT NOT NULL,
    "rewriteVersionId" TEXT NOT NULL,
    "jobId" TEXT,
    "mode" TEXT NOT NULL DEFAULT 'single',
    "scheduledAt" TIMESTAMP(3),
    "status" "PublishStatus" NOT NULL DEFAULT 'QUEUED',
    "idempotencyKey" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "lastError" TEXT,
    "resultMap" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "publish_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publish_results" (
    "id" TEXT NOT NULL,
    "publishJobId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "tweetId" TEXT NOT NULL,
    "tweetUrl" TEXT NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    "responseJson" JSONB NOT NULL DEFAULT '{}',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publish_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "contentItemId" TEXT,
    "action" "AuditAction" NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "actor" TEXT NOT NULL DEFAULT 'system',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_jobs" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "poolId" TEXT NOT NULL,
    "source" "SyncSource" NOT NULL,
    "jobId" TEXT,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "options" JSONB NOT NULL DEFAULT '{}',
    "progress" JSONB NOT NULL DEFAULT '{}',
    "lastCursor" TEXT,
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "dedupedCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pools_workspaceId_idx" ON "pools"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_traceId_key" ON "jobs"("traceId");

-- CreateIndex
CREATE INDEX "jobs_workspaceId_idx" ON "jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "jobs_poolId_idx" ON "jobs"("poolId");

-- CreateIndex
CREATE INDEX "jobs_type_idx" ON "jobs"("type");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_type_idempotencyKey_key" ON "jobs"("type", "idempotencyKey");

-- CreateIndex
CREATE INDEX "steps_jobId_idx" ON "steps"("jobId");

-- CreateIndex
CREATE INDEX "steps_jobId_position_idx" ON "steps"("jobId", "position");

-- CreateIndex
CREATE INDEX "steps_status_availableAt_idx" ON "steps"("status", "availableAt");

-- CreateIndex
CREATE INDEX "steps_type_status_availableAt_idx" ON "steps"("type", "status", "availableAt");

-- CreateIndex
CREATE INDEX "steps_status_leaseExpiresAt_idx" ON "steps"("status", "leaseExpiresAt");

-- CreateIndex
CREATE INDEX "steps_dependsOnStepId_idx" ON "steps"("dependsOnStepId");

-- CreateIndex
CREATE INDEX "step_events_stepId_createdAt_idx" ON "step_events"("stepId", "createdAt");

-- CreateIndex
CREATE INDEX "step_events_stepId_type_idx" ON "step_events"("stepId", "type");

-- CreateIndex
CREATE INDEX "content_items_workspaceId_idx" ON "content_items"("workspaceId");

-- CreateIndex
CREATE INDEX "content_items_poolId_idx" ON "content_items"("poolId");

-- CreateIndex
CREATE INDEX "content_items_jobId_idx" ON "content_items"("jobId");

-- CreateIndex
CREATE INDEX "content_items_captureStatus_idx" ON "content_items"("captureStatus");

-- CreateIndex
CREATE INDEX "content_items_rewriteStatus_idx" ON "content_items"("rewriteStatus");

-- CreateIndex
CREATE INDEX "content_items_publishStatus_idx" ON "content_items"("publishStatus");

-- CreateIndex
CREATE INDEX "content_items_authorHandle_idx" ON "content_items"("authorHandle");

-- CreateIndex
CREATE UNIQUE INDEX "content_items_workspaceId_sourceId_key" ON "content_items"("workspaceId", "sourceId");

-- CreateIndex
CREATE INDEX "tags_workspaceId_idx" ON "tags"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "tags_workspaceId_name_key" ON "tags"("workspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "content_item_tags_contentItemId_tagId_key" ON "content_item_tags"("contentItemId", "tagId");

-- CreateIndex
CREATE UNIQUE INDEX "ingest_jobs_jobId_key" ON "ingest_jobs"("jobId");

-- CreateIndex
CREATE INDEX "ingest_jobs_workspaceId_idx" ON "ingest_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "ingest_jobs_jobId_idx" ON "ingest_jobs"("jobId");

-- CreateIndex
CREATE INDEX "ingest_jobs_status_idx" ON "ingest_jobs"("status");

-- CreateIndex
CREATE INDEX "rewrite_presets_workspaceId_idx" ON "rewrite_presets"("workspaceId");

-- CreateIndex
CREATE UNIQUE INDEX "rewrite_batches_jobId_key" ON "rewrite_batches"("jobId");

-- CreateIndex
CREATE INDEX "rewrite_batches_workspaceId_idx" ON "rewrite_batches"("workspaceId");

-- CreateIndex
CREATE INDEX "rewrite_batches_jobId_idx" ON "rewrite_batches"("jobId");

-- CreateIndex
CREATE INDEX "rewrite_batches_status_idx" ON "rewrite_batches"("status");

-- CreateIndex
CREATE INDEX "rewrite_versions_contentItemId_idx" ON "rewrite_versions"("contentItemId");

-- CreateIndex
CREATE INDEX "rewrite_versions_batchId_idx" ON "rewrite_versions"("batchId");

-- CreateIndex
CREATE INDEX "rewrite_versions_jobId_idx" ON "rewrite_versions"("jobId");

-- CreateIndex
CREATE INDEX "rewrite_versions_stepId_idx" ON "rewrite_versions"("stepId");

-- CreateIndex
CREATE INDEX "rewrite_versions_status_idx" ON "rewrite_versions"("status");

-- CreateIndex
CREATE INDEX "x_accounts_workspaceId_idx" ON "x_accounts"("workspaceId");

-- CreateIndex
CREATE INDEX "x_accounts_xUserId_idx" ON "x_accounts"("xUserId");

-- CreateIndex
CREATE UNIQUE INDEX "x_accounts_workspaceId_xUserId_key" ON "x_accounts"("workspaceId", "xUserId");

-- CreateIndex
CREATE UNIQUE INDEX "publish_jobs_jobId_key" ON "publish_jobs"("jobId");

-- CreateIndex
CREATE INDEX "publish_jobs_workspaceId_idx" ON "publish_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "publish_jobs_jobId_idx" ON "publish_jobs"("jobId");

-- CreateIndex
CREATE INDEX "publish_jobs_status_idx" ON "publish_jobs"("status");

-- CreateIndex
CREATE INDEX "publish_jobs_scheduledAt_idx" ON "publish_jobs"("scheduledAt");

-- CreateIndex
CREATE INDEX "publish_jobs_idempotencyKey_idx" ON "publish_jobs"("idempotencyKey");

-- CreateIndex
CREATE UNIQUE INDEX "publish_jobs_workspaceId_idempotencyKey_key" ON "publish_jobs"("workspaceId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "publish_results_publishJobId_idx" ON "publish_results"("publishJobId");

-- CreateIndex
CREATE INDEX "publish_results_contentItemId_idx" ON "publish_results"("contentItemId");

-- CreateIndex
CREATE UNIQUE INDEX "publish_results_contentItemId_tweetId_key" ON "publish_results"("contentItemId", "tweetId");

-- CreateIndex
CREATE INDEX "audit_logs_workspaceId_idx" ON "audit_logs"("workspaceId");

-- CreateIndex
CREATE INDEX "audit_logs_contentItemId_idx" ON "audit_logs"("contentItemId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sync_jobs_jobId_key" ON "sync_jobs"("jobId");

-- CreateIndex
CREATE INDEX "sync_jobs_workspaceId_idx" ON "sync_jobs"("workspaceId");

-- CreateIndex
CREATE INDEX "sync_jobs_jobId_idx" ON "sync_jobs"("jobId");

-- CreateIndex
CREATE INDEX "sync_jobs_status_idx" ON "sync_jobs"("status");

-- CreateIndex
CREATE INDEX "sync_jobs_createdAt_idx" ON "sync_jobs"("createdAt");

-- AddForeignKey
ALTER TABLE "pools" ADD CONSTRAINT "pools_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "steps" ADD CONSTRAINT "steps_dependsOnStepId_fkey" FOREIGN KEY ("dependsOnStepId") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "step_events" ADD CONSTRAINT "step_events_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_tags" ADD CONSTRAINT "content_item_tags_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_item_tags" ADD CONSTRAINT "content_item_tags_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ingest_jobs" ADD CONSTRAINT "ingest_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_presets" ADD CONSTRAINT "rewrite_presets_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_batches" ADD CONSTRAINT "rewrite_batches_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_batches" ADD CONSTRAINT "rewrite_batches_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "rewrite_presets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_batches" ADD CONSTRAINT "rewrite_batches_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_versions" ADD CONSTRAINT "rewrite_versions_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_versions" ADD CONSTRAINT "rewrite_versions_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "rewrite_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_versions" ADD CONSTRAINT "rewrite_versions_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rewrite_versions" ADD CONSTRAINT "rewrite_versions_stepId_fkey" FOREIGN KEY ("stepId") REFERENCES "steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "x_accounts" ADD CONSTRAINT "x_accounts_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_xAccountId_fkey" FOREIGN KEY ("xAccountId") REFERENCES "x_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_rewriteVersionId_fkey" FOREIGN KEY ("rewriteVersionId") REFERENCES "rewrite_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_jobs" ADD CONSTRAINT "publish_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_results" ADD CONSTRAINT "publish_results_publishJobId_fkey" FOREIGN KEY ("publishJobId") REFERENCES "publish_jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publish_results" ADD CONSTRAINT "publish_results_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "content_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_poolId_fkey" FOREIGN KEY ("poolId") REFERENCES "pools"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

