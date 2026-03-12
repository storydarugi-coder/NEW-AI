-- ============================================
-- CareFlow AI — Supabase PostgreSQL 초기 설정
-- Supabase SQL Editor에서 실행하세요
-- ============================================

-- 1. Patient (환자 운영 데이터)
CREATE TABLE IF NOT EXISTS "Patient" (
  "id"          TEXT PRIMARY KEY,
  "chartNumber" TEXT UNIQUE NOT NULL,
  "gender"      TEXT NOT NULL,
  "birthYear"   INTEGER NOT NULL,
  "isVip"       BOOLEAN NOT NULL DEFAULT false,
  "tags"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

-- 2. PatientIdentity (PII 분리 저장)
CREATE TABLE IF NOT EXISTS "PatientIdentity" (
  "id"        TEXT PRIMARY KEY,
  "patientId" TEXT UNIQUE NOT NULL,
  "name"      TEXT NOT NULL,
  "phone"     TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PatientIdentity_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- 3. Campaign (CTA 광고 캠페인)
CREATE TABLE IF NOT EXISTS "Campaign" (
  "id"           TEXT PRIMARY KEY,
  "name"         TEXT NOT NULL,
  "platform"     TEXT NOT NULL,
  "adType"       TEXT NOT NULL DEFAULT 'cta',
  "startDate"    TIMESTAMP(3) NOT NULL,
  "endDate"      TIMESTAMP(3),
  "budgetWon"    INTEGER,
  "costPerClick" INTEGER,
  "status"       TEXT NOT NULL DEFAULT 'active',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL
);
CREATE INDEX IF NOT EXISTS "Campaign_platform_idx" ON "Campaign"("platform");
CREATE INDEX IF NOT EXISTS "Campaign_status_idx" ON "Campaign"("status");

-- 4. Visit (방문 이력)
CREATE TABLE IF NOT EXISTS "Visit" (
  "id"         TEXT PRIMARY KEY,
  "patientId"  TEXT NOT NULL,
  "visitDate"  TIMESTAMP(3) NOT NULL,
  "memo"       TEXT,
  "sourceRaw"  TEXT,
  "channel"    TEXT,
  "isCta"      BOOLEAN NOT NULL DEFAULT false,
  "campaignId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Visit_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Visit_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Visit_patientId_idx" ON "Visit"("patientId");
CREATE INDEX IF NOT EXISTS "Visit_visitDate_idx" ON "Visit"("visitDate");
CREATE INDEX IF NOT EXISTS "Visit_channel_idx" ON "Visit"("channel");
CREATE INDEX IF NOT EXISTS "Visit_isCta_idx" ON "Visit"("isCta");

-- 5. Diagnosis (진단)
CREATE TABLE IF NOT EXISTS "Diagnosis" (
  "id"      TEXT PRIMARY KEY,
  "visitId" TEXT NOT NULL,
  "code"    TEXT NOT NULL,
  "name"    TEXT NOT NULL,
  "tooth"   TEXT,
  CONSTRAINT "Diagnosis_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Diagnosis_visitId_idx" ON "Diagnosis"("visitId");
CREATE INDEX IF NOT EXISTS "Diagnosis_code_idx" ON "Diagnosis"("code");

-- 6. Procedure (처치)
CREATE TABLE IF NOT EXISTS "Procedure" (
  "id"      TEXT PRIMARY KEY,
  "visitId" TEXT NOT NULL,
  "code"    TEXT NOT NULL,
  "name"    TEXT NOT NULL,
  "tooth"   TEXT,
  CONSTRAINT "Procedure_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "Procedure_visitId_idx" ON "Procedure"("visitId");
CREATE INDEX IF NOT EXISTS "Procedure_code_idx" ON "Procedure"("code");

-- 7. RecallRecommendation (리콜 추천)
CREATE TABLE IF NOT EXISTS "RecallRecommendation" (
  "id"             TEXT PRIMARY KEY,
  "patientId"      TEXT NOT NULL,
  "ruleType"       TEXT NOT NULL,
  "subType"        TEXT NOT NULL,
  "priority"       INTEGER NOT NULL DEFAULT 3,
  "status"         TEXT NOT NULL DEFAULT 'pending',
  "reason"         TEXT NOT NULL,
  "evidenceDate"   TIMESTAMP(3),
  "evidenceDetail" TEXT,
  "dueDate"        TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RecallRecommendation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "RecallRecommendation_patientId_idx" ON "RecallRecommendation"("patientId");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_ruleType_idx" ON "RecallRecommendation"("ruleType");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_status_idx" ON "RecallRecommendation"("status");
CREATE INDEX IF NOT EXISTS "RecallRecommendation_priority_idx" ON "RecallRecommendation"("priority");

-- 8. MessageDraft (문자 초안)
CREATE TABLE IF NOT EXISTS "MessageDraft" (
  "id"        TEXT PRIMARY KEY,
  "patientId" TEXT NOT NULL,
  "recallId"  TEXT,
  "tone"      TEXT NOT NULL DEFAULT 'polite',
  "length"    TEXT NOT NULL DEFAULT 'medium',
  "content"   TEXT NOT NULL,
  "status"    TEXT NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageDraft_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MessageDraft_patientId_idx" ON "MessageDraft"("patientId");
CREATE INDEX IF NOT EXISTS "MessageDraft_status_idx" ON "MessageDraft"("status");

-- 9. MessageDelivery (메시지 발송 추적)
CREATE TABLE IF NOT EXISTS "MessageDelivery" (
  "id"         TEXT PRIMARY KEY,
  "messageId"  TEXT NOT NULL,
  "provider"   TEXT NOT NULL DEFAULT 'kakao_alimtalk',
  "status"     TEXT NOT NULL DEFAULT 'queued',
  "sentAt"     TIMESTAMP(3),
  "failReason" TEXT,
  "retryCount" INTEGER NOT NULL DEFAULT 0,
  "externalId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"  TIMESTAMP(3) NOT NULL,
  CONSTRAINT "MessageDelivery_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "MessageDraft"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "MessageDelivery_messageId_idx" ON "MessageDelivery"("messageId");
CREATE INDEX IF NOT EXISTS "MessageDelivery_status_idx" ON "MessageDelivery"("status");
CREATE INDEX IF NOT EXISTS "MessageDelivery_createdAt_idx" ON "MessageDelivery"("createdAt");

-- 10. LeadAttribution (CTA 유입 귀속)
CREATE TABLE IF NOT EXISTS "LeadAttribution" (
  "id"                 TEXT PRIMARY KEY,
  "visitId"            TEXT UNIQUE NOT NULL,
  "campaignId"         TEXT NOT NULL,
  "reviewStatus"       TEXT NOT NULL DEFAULT 'pending',
  "autoReason"         TEXT,
  "confidence"         DOUBLE PRECISION,
  "reviewer"           TEXT,
  "reviewedAt"         TIMESTAMP(3),
  "reviewMemo"         TEXT,
  "treatmentStarted"   BOOLEAN NOT NULL DEFAULT false,
  "isDuplicate"        BOOLEAN NOT NULL DEFAULT false,
  "settlementMonth"    TEXT,
  "settlementEligible" BOOLEAN NOT NULL DEFAULT false,
  "ineligibleReason"   TEXT,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"          TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeadAttribution_visitId_fkey" FOREIGN KEY ("visitId") REFERENCES "Visit"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "LeadAttribution_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "LeadAttribution_campaignId_idx" ON "LeadAttribution"("campaignId");
CREATE INDEX IF NOT EXISTS "LeadAttribution_reviewStatus_idx" ON "LeadAttribution"("reviewStatus");
CREATE INDEX IF NOT EXISTS "LeadAttribution_settlementMonth_idx" ON "LeadAttribution"("settlementMonth");
CREATE INDEX IF NOT EXISTS "LeadAttribution_createdAt_idx" ON "LeadAttribution"("createdAt");

-- 11. AuditLog (감사 로그)
CREATE TABLE IF NOT EXISTS "AuditLog" (
  "id"         TEXT PRIMARY KEY,
  "action"     TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId"   TEXT NOT NULL,
  "userId"     TEXT,
  "detail"     TEXT,
  "ipAddress"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");
CREATE INDEX IF NOT EXISTS "AuditLog_action_idx" ON "AuditLog"("action");
CREATE INDEX IF NOT EXISTS "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- 12. RuleConfig (규칙 설정)
CREATE TABLE IF NOT EXISTS "RuleConfig" (
  "id"          TEXT PRIMARY KEY,
  "ruleType"    TEXT UNIQUE NOT NULL,
  "displayName" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "enabled"     BOOLEAN NOT NULL DEFAULT true,
  "parameters"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL
);

-- ============================================
-- 완료! 모든 테이블이 생성되었습니다.
-- 다음 단계: 앱 배포 후 /api/seed POST 요청으로 데모 데이터 삽입
-- ============================================
