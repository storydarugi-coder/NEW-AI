/**
 * AI 메시지 출력 후처리 검증기
 *
 * AI가 생성한 메시지의 길이, 금지어, CTA 포함 여부 등을 검증하고
 * 위반 시 자동 보정 또는 fallback을 수행합니다.
 */

import { GeneratedMessages } from "./provider";

/** 검증 결과 */
export interface ValidationResult {
  valid: boolean;
  corrected: boolean;
  issues: string[];
  messages: Omit<GeneratedMessages, "generatedBy">;
}

/** 메시지별 길이 제한 */
const LENGTH_LIMITS = {
  shortMessage: { min: 10, max: 100 },
  standardMessage: { min: 30, max: 200 },
  warmMessage: { min: 50, max: 300 },
} as const;

/** 금지 표현 (의료 확정, 공포 유도, 과장 광고) */
const BANNED_PATTERNS: RegExp[] = [
  // 의료 확정 표현
  /진단\s*(결과|되었|확정)/,
  /확진/,
  /반드시\s*(치료|내원|방문)/,
  /치료하셔야/,
  // 공포 유도 표현
  /방치하면/,
  /악화/,
  /위험합니다/,
  /심각한/,
  /놓치면/,
  /지금\s*안\s*하시면/,
  // 과장 광고 표현
  /특별\s*할인/,
  /무료\s*이벤트/,
  /긴급/,
  /최고의/,
  /놀라운/,
  /파격/,
  /한정/,
];

/** CTA(행동 유도) 키워드 — 하나 이상 포함해야 함 */
const CTA_KEYWORDS = [
  "연락",
  "문의",
  "예약",
  "내원",
  "방문",
  "전화",
  "상담",
];

/**
 * AI 생성 메시지를 검증하고 필요 시 보정
 */
export function validateAIOutput(
  messages: Omit<GeneratedMessages, "generatedBy">
): ValidationResult {
  const issues: string[] = [];
  let corrected = false;
  const result = { ...messages };

  const fields = ["shortMessage", "standardMessage", "warmMessage"] as const;

  for (const field of fields) {
    const text = result[field];

    // 빈 문자열 체크
    if (!text || text.trim().length === 0) {
      issues.push(`${field}: 빈 메시지`);
      continue;
    }

    const limits = LENGTH_LIMITS[field];

    // 너무 짧은 경우
    if (text.length < limits.min) {
      issues.push(`${field}: 너무 짧음 (${text.length}자 < ${limits.min}자)`);
    }

    // 너무 긴 경우 — 자동 잘라내기
    if (text.length > limits.max) {
      issues.push(`${field}: 초과 (${text.length}자 > ${limits.max}자) → 자동 보정`);
      // 마지막 완전한 문장에서 자르기
      const truncated = truncateAtSentence(text, limits.max);
      result[field] = truncated;
      corrected = true;
    }

    // 금지어 체크
    for (const pattern of BANNED_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        issues.push(`${field}: 금지 표현 "${match[0]}" 포함`);
      }
    }
  }

  // CTA 포함 여부 (standardMessage, warmMessage에서만 검사)
  for (const field of ["standardMessage", "warmMessage"] as const) {
    const text = result[field];
    if (text && !CTA_KEYWORDS.some((kw) => text.includes(kw))) {
      issues.push(`${field}: CTA(행동 유도) 문구 없음`);
    }
  }

  // 빈 메시지가 있으면 유효하지 않음
  const hasEmpty = fields.some((f) => !result[f] || result[f].trim().length === 0);
  // 금지어가 포함되면 유효하지 않음
  const hasBanned = issues.some((i) => i.includes("금지 표현"));

  return {
    valid: !hasEmpty && !hasBanned,
    corrected,
    issues,
    messages: result,
  };
}

/**
 * 마지막 완전한 문장 경계에서 자르기
 */
function truncateAtSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;

  const truncated = text.slice(0, maxLength);
  // 마지막 문장 종결 위치 찾기
  const lastEnd = Math.max(
    truncated.lastIndexOf("."),
    truncated.lastIndexOf("!"),
    truncated.lastIndexOf("요."),
    truncated.lastIndexOf("다."),
    truncated.lastIndexOf("세요."),
  );

  if (lastEnd > maxLength * 0.5) {
    return truncated.slice(0, lastEnd + 1);
  }
  // 문장 경계를 찾지 못하면 공백 기준으로 자르기
  const lastSpace = truncated.lastIndexOf(" ");
  if (lastSpace > maxLength * 0.5) {
    return truncated.slice(0, lastSpace);
  }
  return truncated;
}
