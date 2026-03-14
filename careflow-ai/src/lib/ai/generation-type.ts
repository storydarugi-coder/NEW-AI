/**
 * generatedBy → generationType 정규화
 *
 * 내부(DB/AuditLog)에서는 `generatedBy`로 저장됨:
 *   "gemini" | "template" | "fallback" (+ 레거시 "vertex")
 *
 * 외부(API 응답/프론트)에서는 `generationType`으로 통일:
 *   "ai" | "template" | "fallback"
 *
 * 이 모듈은 두 체계 사이의 단일 변환 지점을 제공합니다.
 *
 * ── 장기 제거 계획 ──
 * - generatedBy: 내부 레거시 필드. AuditLog JSON 안에 존재하므로 읽기만 허용.
 * - generationType: 외부 공식 필드. 신규 코드에서는 이 값만 사용.
 * - "vertex": 레거시 프로바이더명. normalizeGenerationType에서 "ai"로 변환.
 */

export type GenerationType = "ai" | "template" | "fallback";

const INTERNAL_TO_EXTERNAL: Record<string, GenerationType> = {
  gemini: "ai",
  vertex: "ai",        // 레거시 프로바이더
  ai: "ai",            // 이미 정규화된 값
  template: "template",
  fallback: "fallback",
};

/**
 * 내부 generatedBy 값을 외부 generationType으로 정규화.
 * 알 수 없는 값은 "fallback"으로 안전하게 매핑.
 */
export function normalizeGenerationType(generatedBy: string | null | undefined): GenerationType {
  if (!generatedBy) return "fallback";
  return INTERNAL_TO_EXTERNAL[generatedBy] || "fallback";
}

/** UI 표시용 라벨 */
export const GENERATION_TYPE_LABELS: Record<GenerationType, string> = {
  ai: "AI 자동 생성",
  template: "템플릿 생성",
  fallback: "기본 메시지",
};
