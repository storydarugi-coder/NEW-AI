/**
 * 방문경로 정규화 서비스
 *
 * 자유입력 방문 경로 텍스트를 표준화된 채널/분류로 변환합니다.
 * "시스템 추천 + 사람 확정" 흐름의 핵심 모듈입니다.
 *
 * 구조:
 * 1. raw text 전처리
 * 2. 규칙 사전 기반 키워드 매칭
 * 3. normalized source / category / CTA candidate 추천
 * 4. confidence 산정
 * 5. match reason 생성
 */

import { DEFAULT_SOURCE_RULES, type SourceRuleDefinition } from "./rules";

export interface NormalizationResult {
  /** 시스템 추천 정규화 소스명 */
  normalizedSource: string;
  /** 시스템 추천 카테고리 */
  sourceCategory: string;
  /** CTA 후보 여부 */
  ctaCandidate: boolean;
  /** 매칭 신뢰도 */
  matchConfidence: "HIGH" | "MEDIUM" | "LOW";
  /** 매칭 근거 */
  matchReason: string;
  /** 매칭된 규칙 이름 (없으면 null) */
  matchedRuleName: string | null;
  /** 매칭된 키워드 (없으면 null) */
  matchedKeyword: string | null;
}

/**
 * 원문 텍스트 전처리
 * - 소문자 변환
 * - 불필요한 공백 제거
 * - 특수문자 정리
 */
function preprocessRawText(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[→➡►▶]/g, " ")
    .replace(/ㅎㅎ|ㅋㅋ|ㅠㅠ|ㅜㅜ|;;/g, "")
    .trim();
}

/**
 * 규칙 기반 매칭 실행
 *
 * @param rawText - 자유입력 원문 텍스트
 * @param rules - 분류 규칙 사전 (DB 또는 기본값)
 * @returns 정규화 결과
 */
export function normalizeSource(
  rawText: string | null | undefined,
  rules?: SourceRuleDefinition[]
): NormalizationResult {
  if (!rawText || rawText.trim() === "") {
    return {
      normalizedSource: "Unknown",
      sourceCategory: "Unknown",
      ctaCandidate: false,
      matchConfidence: "LOW",
      matchReason: "유입 경로 미입력",
      matchedRuleName: null,
      matchedKeyword: null,
    };
  }

  const activeRules = (rules || DEFAULT_SOURCE_RULES)
    .filter((r) => r.isActive)
    .sort((a, b) => a.priority - b.priority);

  const processed = preprocessRawText(rawText);

  // 규칙 사전 순서대로 매칭 시도
  for (const rule of activeRules) {
    for (const keyword of rule.keywords) {
      const kw = keyword.toLowerCase();
      if (processed.includes(kw)) {
        // 구체적인 키워드일수록 높은 신뢰도
        const confidence = determineConfidence(kw, processed, rule);

        return {
          normalizedSource: rule.normalizedSource,
          sourceCategory: rule.sourceCategory,
          ctaCandidate: rule.ctaCandidate,
          matchConfidence: confidence,
          matchReason: `"${rawText}" → "${keyword}" 키워드 매칭 → ${rule.normalizedSource} (${rule.description || rule.ruleName})`,
          matchedRuleName: rule.ruleName,
          matchedKeyword: keyword,
        };
      }
    }
  }

  // "광고" 단어만 포함된 경우 → CTA 후보지만 플랫폼 미확인
  if (processed.includes("광고")) {
    return {
      normalizedSource: "Online Ads (Unspecified)",
      sourceCategory: "Display Ads",
      ctaCandidate: true,
      matchConfidence: "LOW",
      matchReason: `"${rawText}" → "광고" 키워드 포함이지만 구체 플랫폼 미확인, 수동 검토 필요`,
      matchedRuleName: null,
      matchedKeyword: "광고",
    };
  }

  // 매칭 실패 → Unknown
  return {
    normalizedSource: "Unknown",
    sourceCategory: "Unknown",
    ctaCandidate: false,
    matchConfidence: "LOW",
    matchReason: `"${rawText}" → 분류 규칙에 해당하지 않음, 수동 검토 필요`,
    matchedRuleName: null,
    matchedKeyword: null,
  };
}

/**
 * 신뢰도 산정
 *
 * - 긴 키워드(3글자 이상)가 정확히 매칭되면 HIGH
 * - 짧은 키워드(2글자)이거나 원문이 복합적이면 MEDIUM
 * - 광고/비광고가 혼재하면 LOW
 */
function determineConfidence(
  keyword: string,
  processed: string,
  rule: SourceRuleDefinition
): "HIGH" | "MEDIUM" | "LOW" {
  // 광고와 비광고 키워드가 동시에 있으면 신뢰도 낮음
  const hasAdKeyword = processed.includes("광고");
  const hasReferralKeyword = ["소개", "추천", "지인"].some((k) =>
    processed.includes(k)
  );

  if (hasAdKeyword && hasReferralKeyword) return "LOW";

  // 구체적 키워드 (3글자+)로 매칭되면 높은 신뢰도
  if (keyword.length >= 3 && rule.priority <= 15) return "HIGH";

  // 짧은 키워드 or 낮은 우선순위 규칙이면 보통
  if (keyword.length < 3 || rule.priority >= 40) return "MEDIUM";

  return "HIGH";
}

/**
 * 여러 방문 기록을 일괄 정규화
 */
export function normalizeSourceBatch(
  items: { id: string; sourceRaw: string | null }[],
  rules?: SourceRuleDefinition[]
): Map<string, NormalizationResult> {
  const results = new Map<string, NormalizationResult>();
  for (const item of items) {
    results.set(item.id, normalizeSource(item.sourceRaw, rules));
  }
  return results;
}

/**
 * DB의 SourceRule 레코드를 SourceRuleDefinition 형태로 변환
 */
export function dbRuleToDefinition(dbRule: {
  ruleName: string;
  keywords: string;
  normalizedSource: string;
  sourceCategory: string;
  ctaCandidate: boolean;
  priority: number;
  isActive: boolean;
  description: string | null;
}): SourceRuleDefinition {
  let parsedKeywords: string[];
  try {
    parsedKeywords = JSON.parse(dbRule.keywords);
  } catch {
    parsedKeywords = [dbRule.keywords];
  }

  return {
    ruleName: dbRule.ruleName,
    keywords: parsedKeywords,
    normalizedSource: dbRule.normalizedSource,
    sourceCategory: dbRule.sourceCategory,
    ctaCandidate: dbRule.ctaCandidate,
    priority: dbRule.priority,
    isActive: dbRule.isActive,
    description: dbRule.description || "",
  };
}
