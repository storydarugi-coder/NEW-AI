-- ============================================================
-- 레거시 tenantId 현황 점검 및 백필 쿼리
-- 실행 환경: PostgreSQL (Prisma 기반)
-- 목적: tenantId가 NULL인 레거시 데이터를 식별하고
--        적절한 테넌트에 배정하는 마이그레이션 쿼리
-- ============================================================

-- ── 1. 현황 점검: tenantId NULL 레코드 수 ──

SELECT 'Patient' AS model,
       COUNT(*) FILTER (WHERE "tenantId" IS NULL) AS null_count,
       COUNT(*) AS total,
       ROUND(100.0 * COUNT(*) FILTER (WHERE "tenantId" IS NULL) / NULLIF(COUNT(*), 0), 1) AS null_pct
FROM "Patient"
UNION ALL
SELECT 'User',
       COUNT(*) FILTER (WHERE "tenantId" IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE "tenantId" IS NULL) / NULLIF(COUNT(*), 0), 1)
FROM "User"
UNION ALL
SELECT 'Staff',
       COUNT(*) FILTER (WHERE "tenantId" IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE "tenantId" IS NULL) / NULLIF(COUNT(*), 0), 1)
FROM "Staff"
UNION ALL
SELECT 'RuleConfig',
       COUNT(*) FILTER (WHERE "tenantId" IS NULL),
       COUNT(*),
       ROUND(100.0 * COUNT(*) FILTER (WHERE "tenantId" IS NULL) / NULLIF(COUNT(*), 0), 1)
FROM "RuleConfig"
ORDER BY model;

-- ── 2. 현황 점검: 테넌트별 분포 ──

SELECT 'Patient' AS model, "tenantId", COUNT(*) AS cnt
FROM "Patient" GROUP BY "tenantId"
UNION ALL
SELECT 'User', "tenantId", COUNT(*) FROM "User" GROUP BY "tenantId"
UNION ALL
SELECT 'Staff', "tenantId", COUNT(*) FROM "Staff" GROUP BY "tenantId"
UNION ALL
SELECT 'RuleConfig', "tenantId", COUNT(*) FROM "RuleConfig" GROUP BY "tenantId"
ORDER BY model, "tenantId" NULLS FIRST;

-- ── 3. 연관 모델에서 tenantId 미배정 데이터 추적 ──

-- WorkflowTask의 환자 중 tenantId 없는 건
SELECT 'WorkflowTask with NULL tenant Patient' AS issue,
       COUNT(*) AS cnt
FROM "WorkflowTask" wt
JOIN "Patient" p ON p.id = wt."patientId"
WHERE p."tenantId" IS NULL;

-- OutboundMessage의 환자 중 tenantId 없는 건
SELECT 'OutboundMessage with NULL tenant Patient' AS issue,
       COUNT(*) AS cnt
FROM "OutboundMessage" om
JOIN "Patient" p ON p.id = om."patientId"
WHERE p."tenantId" IS NULL;

-- Visit의 환자 중 tenantId 없는 건
SELECT 'Visit with NULL tenant Patient' AS issue,
       COUNT(*) AS cnt
FROM "Visit" v
JOIN "Patient" p ON p.id = v."patientId"
WHERE p."tenantId" IS NULL;

-- ── 4. 백필 쿼리 (실행 전 반드시 DRY RUN 확인) ──
-- 아래는 예시입니다. 실제 실행 시 테넌트 ID를 환경에 맞게 변경하세요.

-- 4a. 단일 병원 환경: 모든 NULL 환자를 기본 테넌트에 배정
-- UPDATE "Patient" SET "tenantId" = 'tenant_default'
-- WHERE "tenantId" IS NULL;

-- 4b. Staff 백필
-- UPDATE "Staff" SET "tenantId" = 'tenant_default'
-- WHERE "tenantId" IS NULL;

-- 4c. RuleConfig 백필 (병원별 설정이 다를 수 있으므로 주의)
-- UPDATE "RuleConfig" SET "tenantId" = 'tenant_default'
-- WHERE "tenantId" IS NULL;

-- 4d. User 백필 (hospital 계정만, internal/all은 NULL 유지)
-- UPDATE "User" SET "tenantId" = 'tenant_default'
-- WHERE "tenantId" IS NULL AND "productArea" = 'hospital';

-- ── 5. 백필 후 검증 ──
-- 위 1번 쿼리를 다시 실행하여 NULL 비율이 0%인지 확인
-- hospital User 중 tenantId가 NULL인 건이 없는지 확인:
-- SELECT id, username, name, "productArea", "tenantId"
-- FROM "User"
-- WHERE "productArea" = 'hospital' AND "tenantId" IS NULL;
