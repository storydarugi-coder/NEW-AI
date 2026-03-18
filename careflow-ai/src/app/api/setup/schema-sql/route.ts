import { NextResponse } from "next/server";

/**
 * Supabase SQL Editor에서 실행할 수 있는 스키마 SQL을 반환합니다.
 * prisma db push를 로컬에서 실행할 수 없는 경우 이 SQL을 사용합니다.
 */

const SCHEMA_SQL = `
-- ============================================================
-- CareFlow AI — 전체 스키마 (Supabase SQL Editor에서 실행)
-- prisma/schema.prisma 기반 자동 생성
-- ============================================================

-- CreateTable
CREATE TABLE IF NOT EXISTS "Patient" (
    "id" TEXT NOT NULL,
    "chartNumber" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birthYear" INTEGER NOT NULL,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "doNotContactAt" TIMESTAMP(3),
    "doNotContactReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Patient_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "PatientIdentity" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PatientIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Campaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "adType" TEXT NOT NULL DEFAULT 'cta',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "budgetWon" INTEGER,
    "costPerClick" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SourceRule" (
    "id" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "keywords" TEXT NOT NULL,
    "normalizedSource" TEXT NOT NULL,
    "sourceCategory" TEXT NOT NULL,
    "ctaCandidate" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SourceRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Visit" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "memo" TEXT,
    "sourceRaw" TEXT,
    "channel" TEXT,
    "isCta" BOOLEAN NOT NULL DEFAULT false,
    "campaignId" TEXT,
    "normalizedSource" TEXT,
    "sourceCategory" TEXT,
    "ctaCandidate" BOOLEAN,
    "matchConfidence" TEXT,
    "matchReason" TEXT,
    "matchedRuleId" TEXT,
    "reviewedSource" TEXT,
    "reviewedCategory" TEXT,
    "reviewedCtaFlag" BOOLEAN,
    "sourceReviewStatus" TEXT NOT NULL DEFAULT 'unreviewed',
    "sourceReviewedBy" TEXT,
    "sourceReviewedAt" TIMESTAMP(3),
    "sourceReviewMemo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Visit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Diagnosis" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tooth" TEXT,
    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Procedure" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tooth" TEXT,
    CONSTRAINT "Procedure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RecallRecommendation" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "subType" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reason" TEXT NOT NULL,
    "evidenceDate" TIMESTAMP(3),
    "evidenceDetail" TEXT,
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecallRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageDraft" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "recallId" TEXT,
    "tone" TEXT NOT NULL DEFAULT 'polite',
    "length" TEXT NOT NULL DEFAULT 'medium',
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageDraft_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MessageDelivery" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'kakao_alimtalk',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sentAt" TIMESTAMP(3),
    "failReason" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeadAttribution" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "reviewStatus" TEXT NOT NULL DEFAULT 'pending',
    "autoReason" TEXT,
    "confidence" DOUBLE PRECISION,
    "reviewer" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewMemo" TEXT,
    "treatmentStarted" BOOLEAN NOT NULL DEFAULT false,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "settlementMonth" TEXT,
    "settlementEligible" BOOLEAN NOT NULL DEFAULT false,
    "ineligibleReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LeadAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "userId" TEXT,
    "detail" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Staff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'desk',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WorkflowTask" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unprocessed',
    "assigneeId" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT,
    "patientId" TEXT,
    "staffId" TEXT,
    "action" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RuleConfig" (
    "id" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "parameters" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RuleConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'DESK',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SyncJob" (
    "id" TEXT NOT NULL,
    "syncType" TEXT NOT NULL,
    "sourceSystem" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "unclassifiedCount" INTEGER NOT NULL DEFAULT 0,
    "errorSummary" TEXT,
    "triggeredBy" TEXT NOT NULL,
    "notes" TEXT,
    "importBatchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SyncJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ImportBatch" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "successCount" INTEGER NOT NULL DEFAULT 0,
    "failCount" INTEGER NOT NULL DEFAULT 0,
    "unclassifiedCount" INTEGER NOT NULL DEFAULT 0,
    "reviewNeededCount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'processing',
    "errorDetail" TEXT,
    "importedBy" TEXT NOT NULL DEFAULT '운영자',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SourceNormalizationHistory" (
    "id" TEXT NOT NULL,
    "visitId" TEXT NOT NULL,
    "batchKey" TEXT,
    "prevNormalizedSource" TEXT,
    "prevCategory" TEXT,
    "prevCtaCandidate" BOOLEAN,
    "prevReviewStatus" TEXT,
    "newNormalizedSource" TEXT,
    "newCategory" TEXT,
    "newCtaCandidate" BOOLEAN,
    "newReviewStatus" TEXT,
    "changeType" TEXT NOT NULL,
    "changedBy" TEXT NOT NULL DEFAULT '운영자',
    "changeMemo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SourceNormalizationHistory_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OutboundMessage" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "relatedTaskId" TEXT,
    "channel" TEXT NOT NULL DEFAULT 'KAKAO',
    "templateType" TEXT,
    "draftMessage" TEXT NOT NULL,
    "finalMessage" TEXT,
    "approvalStatus" TEXT NOT NULL DEFAULT 'DRAFT',
    "approvalMemo" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedReason" TEXT,
    "sendStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "scheduledAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "sendAttemptCount" INTEGER NOT NULL DEFAULT 0,
    "externalId" TEXT,
    "provider" TEXT,
    "duplicateBlocked" BOOLEAN NOT NULL DEFAULT false,
    "duplicateReason" TEXT,
    "doNotContactBlocked" BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "sentBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OutboundMessage_pkey" PRIMARY KEY ("id")
);

-- ============================================================
-- Migration: Add missing columns to existing tables
-- (safe to re-run: ADD COLUMN IF NOT EXISTS)
-- ============================================================

-- Visit table: source normalization & review columns
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "normalizedSource" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "sourceCategory" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "ctaCandidate" BOOLEAN;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "matchConfidence" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "matchReason" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "matchedRuleId" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "reviewedSource" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "reviewedCategory" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "reviewedCtaFlag" BOOLEAN;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "sourceReviewStatus" TEXT NOT NULL DEFAULT 'unreviewed';
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "sourceReviewedBy" TEXT;
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "sourceReviewedAt" TIMESTAMP(3);
ALTER TABLE "Visit" ADD COLUMN IF NOT EXISTS "sourceReviewMemo" TEXT;

-- Unique Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "Patient_chartNumber_key" ON "Patient"("chartNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "PatientIdentity_patientId_key" ON "PatientIdentity"("patientId");
CREATE UNIQUE INDEX IF NOT EXISTS "LeadAttribution_visitId_key" ON "LeadAttribution"("visitId");
CREATE UNIQUE INDEX IF NOT EXISTS "SourceRule_ruleName_key" ON "SourceRule"("ruleName");
CREATE UNIQUE INDEX IF NOT EXISTS "RuleConfig_ruleType_key" ON "RuleConfig"("ruleType");
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");

-- Performance Indexes
CREATE INDEX IF NOT EXISTS "Visit_patientId_idx" ON "Visit"("patientId");
CREATE INDEX IF NOT EXISTS "Visit_visitDate_idx" ON "Visit"("visitDate");
CREATE INDEX IF NOT EXISTS "Visit_channel_idx" ON "Visit"("channel");
CREATE INDEX IF NOT EXISTS "Visit_isCta_idx" ON "Visit"("isCta");
CREATE INDEX IF NOT EXISTS "Visit_sourceReviewStatus_idx" ON "Visit"("sourceReviewStatus");
CREATE INDEX IF NOT EXISTS "Visit_matchConfidence_idx" ON "Visit"("matchConfidence");
CREATE INDEX IF NOT EXISTS "Diagnosis_visitId_idx" ON "Diagnosis"("visitId");
CREATE INDEX IF NOT EXISTS "Diagnosis_code_idx" ON "Diagnosis"("code");
CREATE INDEX IF NOT EXISTS "Procedure_visitId_idx" ON "Procedure"("visitId");
CREATE INDEX IF NOT EXISTS "Procedure_code_idx" ON "Procedure"("code");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_patientId_idx" ON "RecallRecommendation"("patientId");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_ruleType_idx" ON "RecallRecommendation"("ruleType");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_status_idx" ON "RecallRecommendation"("status");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_priority_idx" ON "RecallRecommendation"("priority");
CREATE INDEX IF NOT EXISTS "MessageDraft_patientId_idx" ON "MessageDraft"("patientId");
CREATE INDEX IF NOT EXISTS "MessageDraft_status_idx" ON "MessageDraft"("status");
CREATE INDEX IF NOT EXISTS "MessageDelivery_messageId_idx" ON "MessageDelivery"("messageId");
CREATE INDEX IF NOT EXISTS "MessageDelivery_status_idx" ON "MessageDelivery"("status");
CREATE INDEX IF NOT EXISTS "MessageDelivery_createdAt_idx" ON "MessageDelivery"("createdAt");
CREATE INDEX IF NOT EXISTS "Campaign_platform_idx" ON "Campaign"("platform");
CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX IF NOT EXISTS "LeadAttribution_campaignId_idx" ON "LeadAttribution"("campaignId");
CREATE INDEX IF NOT EXISTS "LeadAttribution_reviewStatus_idx" ON "LeadAttribution"("reviewStatus");
CREATE INDEX IF NOT EXISTS "LeadAttribution_settlementMonth_idx" ON "LeadAttribution"("settlementMonth");
CREATE INDEX IF NOT EXISTS "LeadAttribution_createdAt_idx" ON "LeadAttribution"("createdAt");
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX IF NOT EXISTS "Staff_role_idx" ON "Staff"("role");
CREATE INDEX IF NOT EXISTS "Staff_isActive_idx" ON "Staff"("isActive");
CREATE INDEX IF NOT EXISTS "WorkflowTask_patientId_idx" ON "WorkflowTask"("patientId");
CREATE INDEX IF NOT EXISTS "WorkflowTask_status_idx" ON "WorkflowTask"("status");
CREATE INDEX IF NOT EXISTS "WorkflowTask_actionType_idx" ON "WorkflowTask"("actionType");
CREATE INDEX IF NOT EXISTS "WorkflowTask_assigneeId_idx" ON "WorkflowTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "WorkflowTask_nextFollowUpAt_idx" ON "WorkflowTask"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "WorkflowTask_createdAt_idx" ON "WorkflowTask"("createdAt");
CREATE INDEX IF NOT EXISTS "ActivityLog_taskId_idx" ON "ActivityLog"("taskId");
CREATE INDEX IF NOT EXISTS "ActivityLog_patientId_idx" ON "ActivityLog"("patientId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");
CREATE INDEX IF NOT EXISTS "SourceRule_isActive_idx" ON "SourceRule"("isActive");
CREATE INDEX IF NOT EXISTS "SourceRule_priority_idx" ON "SourceRule"("priority");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
CREATE INDEX IF NOT EXISTS "SyncJob_syncType_idx" ON "SyncJob"("syncType");
CREATE INDEX IF NOT EXISTS "SyncJob_status_idx" ON "SyncJob"("status");
CREATE INDEX IF NOT EXISTS "SyncJob_startedAt_idx" ON "SyncJob"("startedAt");
CREATE INDEX IF NOT EXISTS "SyncJob_createdAt_idx" ON "SyncJob"("createdAt");
CREATE INDEX IF NOT EXISTS "ImportBatch_status_idx" ON "ImportBatch"("status");
CREATE INDEX IF NOT EXISTS "ImportBatch_createdAt_idx" ON "ImportBatch"("createdAt");
CREATE INDEX IF NOT EXISTS "SourceNormalizationHistory_visitId_idx" ON "SourceNormalizationHistory"("visitId");
CREATE INDEX IF NOT EXISTS "SourceNormalizationHistory_batchKey_idx" ON "SourceNormalizationHistory"("batchKey");
CREATE INDEX IF NOT EXISTS "SourceNormalizationHistory_changeType_idx" ON "SourceNormalizationHistory"("changeType");
CREATE INDEX IF NOT EXISTS "SourceNormalizationHistory_createdAt_idx" ON "SourceNormalizationHistory"("createdAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_patientId_idx" ON "OutboundMessage"("patientId");
CREATE INDEX IF NOT EXISTS "OutboundMessage_approvalStatus_idx" ON "OutboundMessage"("approvalStatus");
CREATE INDEX IF NOT EXISTS "OutboundMessage_sendStatus_idx" ON "OutboundMessage"("sendStatus");
CREATE INDEX IF NOT EXISTS "OutboundMessage_messageType_idx" ON "OutboundMessage"("messageType");
CREATE INDEX IF NOT EXISTS "OutboundMessage_scheduledAt_idx" ON "OutboundMessage"("scheduledAt");
CREATE INDEX IF NOT EXISTS "OutboundMessage_createdAt_idx" ON "OutboundMessage"("createdAt");

-- Foreign Keys (idempotent: skip if constraint already exists)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PatientIdentity_patientId_fkey') THEN
    ALTER TABLE "PatientIdentity" ADD CONSTRAINT "PatientIdentity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Visit_patientId_fkey') THEN
    ALTER TABLE "Visit" ADD CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Visit_campaignId_fkey') THEN
    ALTER TABLE "Visit" ADD CONSTRAINT "Visit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Visit_matchedRuleId_fkey') THEN
    ALTER TABLE "Visit" ADD CONSTRAINT "Visit_matchedRuleId_fkey" FOREIGN KEY ("matchedRuleId") REFERENCES "SourceRule"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Diagnosis_visitId_fkey') THEN
    ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Procedure_visitId_fkey') THEN
    ALTER TABLE "Procedure" ADD CONSTRAINT "Procedure_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RecallRecommendation_patientId_fkey') THEN
    ALTER TABLE "RecallRecommendation" ADD CONSTRAINT "RecallRecommendation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDraft_patientId_fkey') THEN
    ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MessageDelivery_messageId_fkey') THEN
    ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadAttribution_visitId_fkey') THEN
    ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LeadAttribution_campaignId_fkey') THEN
    ALTER TABLE "LeadAttribution" ADD CONSTRAINT "LeadAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowTask_patientId_fkey') THEN
    ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WorkflowTask_assigneeId_fkey') THEN
    ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_taskId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_patientId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_staffId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OutboundMessage_patientId_fkey') THEN
    ALTER TABLE "OutboundMessage" ADD CONSTRAINT "OutboundMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
`.trim();

export async function GET() {
  const WARNING = `-- ⚠️ 경고: 이 SQL은 과거 버전 기준으로 하드코딩되어 있습니다.
-- 최신 스키마(tenantId, productArea, Tenant 테이블 등)가 포함되어 있지 않습니다.
-- 가능하면 로컬에서 npx prisma db push 를 실행하세요.
-- 또는 Vercel 재배포 시 자동으로 prisma db push가 실행됩니다.
-- ================================================================

`;
  return new NextResponse(WARNING + SCHEMA_SQL, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}
