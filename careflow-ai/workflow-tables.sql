-- =============================================
-- CareFlow AI 워크플로우 테이블 생성 SQL
-- Supabase SQL Editor에서 실행하세요
-- =============================================

-- 1. Staff (담당자)
CREATE TABLE IF NOT EXISTS "Staff" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'desk',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Staff_role_idx" ON "Staff"("role");
CREATE INDEX IF NOT EXISTS "Staff_isActive_idx" ON "Staff"("isActive");

-- 2. WorkflowTask (업무 아이템)
CREATE TABLE IF NOT EXISTS "WorkflowTask" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "patientId" TEXT NOT NULL,
    "actionType" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'unprocessed',
    "assigneeId" TEXT,
    "note" TEXT,
    "reason" TEXT,
    "nextFollowUpAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkflowTask_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "WorkflowTask" ADD CONSTRAINT "WorkflowTask_assigneeId_fkey"
    FOREIGN KEY ("assigneeId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "WorkflowTask_patientId_idx" ON "WorkflowTask"("patientId");
CREATE INDEX IF NOT EXISTS "WorkflowTask_status_idx" ON "WorkflowTask"("status");
CREATE INDEX IF NOT EXISTS "WorkflowTask_actionType_idx" ON "WorkflowTask"("actionType");
CREATE INDEX IF NOT EXISTS "WorkflowTask_assigneeId_idx" ON "WorkflowTask"("assigneeId");
CREATE INDEX IF NOT EXISTS "WorkflowTask_nextFollowUpAt_idx" ON "WorkflowTask"("nextFollowUpAt");
CREATE INDEX IF NOT EXISTS "WorkflowTask_createdAt_idx" ON "WorkflowTask"("createdAt");

-- 3. ActivityLog (변경 이력)
CREATE TABLE IF NOT EXISTS "ActivityLog" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
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

ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "WorkflowTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_staffId_fkey"
    FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "ActivityLog_taskId_idx" ON "ActivityLog"("taskId");
CREATE INDEX IF NOT EXISTS "ActivityLog_patientId_idx" ON "ActivityLog"("patientId");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

-- 완료!
SELECT 'Tables created successfully!' AS result;
