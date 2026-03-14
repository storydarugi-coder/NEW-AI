import type { SessionUser } from "./auth";

/**
 * 테넌트 스코프 헬퍼
 *
 * 현재 단계: tenantId는 optional (null 허용)
 * - tenantId가 있는 세션 → 해당 테넌트 데이터만 반환
 * - tenantId가 없는 세션 → 전체 데이터 반환 (레거시/슈퍼어드민)
 *
 * 사용법:
 *   const scope = getTenantScope(session);
 *   prisma.patient.findMany({ where: { ...scope, ...otherFilters } });
 */

export interface TenantScope {
  tenantId?: string | null;
}

/**
 * 세션에서 테넌트 스코프 WHERE 조건 생성
 * - tenantId가 있으면 { tenantId: "xxx" }
 * - tenantId가 없으면 {} (전체 조회)
 */
export function getTenantScope(session: SessionUser): TenantScope {
  if (session.tenantId) {
    return { tenantId: session.tenantId };
  }
  return {};
}

/**
 * 데이터 생성 시 tenantId를 자동으로 포함
 */
export function withTenantId(session: SessionUser): { tenantId: string | null } {
  return { tenantId: session.tenantId ?? null };
}

/**
 * 테넌트 간 데이터 접근 차단 검증
 * 조회된 레코드의 tenantId가 세션의 tenantId와 일치하는지 확인
 */
export function assertTenantAccess(
  session: SessionUser,
  record: { tenantId?: string | null }
): boolean {
  // 슈퍼어드민(tenantId 없음)은 모든 데이터 접근 가능
  if (!session.tenantId) return true;
  // 레거시 데이터(tenantId null)는 모든 세션에서 접근 가능
  if (!record.tenantId) return true;
  // 테넌트 불일치 시 차단
  return record.tenantId === session.tenantId;
}
