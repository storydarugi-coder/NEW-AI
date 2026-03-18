-- ============================================================
-- Visit.tenantId / Campaign.tenantId 백필 마이그레이션
-- 실행 환경: PostgreSQL (Prisma 기반)
-- 전제: Patient.tenantId가 이미 배정되어 있어야 함
-- ============================================================

-- ── 0. 사전 점검: Patient.tenantId 배정 현황 ──
SELECT 'Patient' AS model,
       COUNT(*) FILTER (WHERE "tenantId" IS NOT NULL) AS assigned,
       COUNT(*) FILTER (WHERE "tenantId" IS NULL) AS unassigned,
       COUNT(*) AS total
FROM "Patient";

-- ── 1. Visit.tenantId 백필 ──
-- Patient.tenantId를 Visit.tenantId로 복사
-- 안전: nullable 컬럼이므로 기존 NULL은 유지
BEGIN;

UPDATE "Visit" v
SET "tenantId" = p."tenantId"
FROM "Patient" p
WHERE v."patientId" = p.id
  AND v."tenantId" IS NULL
  AND p."tenantId" IS NOT NULL;

-- 검증
SELECT 'Visit 백필 결과' AS step,
       COUNT(*) FILTER (WHERE "tenantId" IS NOT NULL) AS filled,
       COUNT(*) FILTER (WHERE "tenantId" IS NULL) AS remaining,
       COUNT(*) AS total
FROM "Visit";

COMMIT;

-- ── 2. Campaign.tenantId 백필 ──
-- Campaign은 Visit을 통해 Patient.tenantId를 추론
-- 한 캠페인이 여러 테넌트의 Visit을 가질 수 있으므로
-- 가장 많은 Visit을 보유한 테넌트를 소유자로 지정
BEGIN;

WITH campaign_tenant AS (
  SELECT
    v."campaignId",
    p."tenantId",
    COUNT(*) AS visit_count,
    ROW_NUMBER() OVER (PARTITION BY v."campaignId" ORDER BY COUNT(*) DESC) AS rn
  FROM "Visit" v
  JOIN "Patient" p ON v."patientId" = p.id
  WHERE v."campaignId" IS NOT NULL
    AND p."tenantId" IS NOT NULL
  GROUP BY v."campaignId", p."tenantId"
)
UPDATE "Campaign" c
SET "tenantId" = ct."tenantId"
FROM campaign_tenant ct
WHERE c.id = ct."campaignId"
  AND ct.rn = 1
  AND c."tenantId" IS NULL;

-- 검증
SELECT 'Campaign 백필 결과' AS step,
       COUNT(*) FILTER (WHERE "tenantId" IS NOT NULL) AS filled,
       COUNT(*) FILTER (WHERE "tenantId" IS NULL) AS remaining,
       COUNT(*) AS total
FROM "Campaign";

COMMIT;

-- ── 3. 최종 검증 ──
SELECT 'Visit' AS model, "tenantId", COUNT(*) AS cnt
FROM "Visit" GROUP BY "tenantId"
UNION ALL
SELECT 'Campaign', "tenantId", COUNT(*)
FROM "Campaign" GROUP BY "tenantId"
ORDER BY model, "tenantId" NULLS FIRST;

-- ── 롤백 방법 ──
-- 문제 발생 시 아래 쿼리로 원복:
-- UPDATE "Visit" SET "tenantId" = NULL;
-- UPDATE "Campaign" SET "tenantId" = NULL;
