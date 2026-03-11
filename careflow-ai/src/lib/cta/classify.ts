/**
 * CTA 유입 분류 엔진
 * 자유입력 방문 경로 텍스트 → 표준 채널 + CTA 후보 여부 판정
 *
 * 반자동 구조: 규칙 기반 자동 분류 → 운영자 검토 → 확정/반려
 */

export interface ClassifyResult {
  channel: string;
  isCta: boolean;
  confidence: number;
  autoReason: string;
}

// 키워드 → 채널 매핑 규칙
const CHANNEL_RULES: {
  keywords: string[];
  channel: string;
  isCta: boolean;
  label: string;
}[] = [
  // CTA 광고 채널
  {
    keywords: ["네이버 광고", "네이버 검색광고", "네이버 파워링크", "네이버 플레이스 광고"],
    channel: "cta_naver",
    isCta: true,
    label: "네이버 광고",
  },
  {
    keywords: ["구글 광고", "구글 검색", "구글 애즈", "google ads"],
    channel: "cta_google",
    isCta: true,
    label: "구글 광고",
  },
  {
    keywords: ["카카오 광고", "카카오모먼트", "카카오 비즈보드"],
    channel: "cta_kakao",
    isCta: true,
    label: "카카오 광고",
  },
  {
    keywords: ["인스타", "인스타그램", "instagram", "인스타 광고"],
    channel: "cta_instagram",
    isCta: true,
    label: "인스타그램 광고",
  },
  {
    keywords: ["페이스북", "facebook", "fb 광고", "메타 광고"],
    channel: "cta_meta",
    isCta: true,
    label: "메타/페이스북 광고",
  },
  {
    keywords: ["유튜브 광고", "youtube 광고"],
    channel: "cta_youtube",
    isCta: true,
    label: "유튜브 광고",
  },
  {
    keywords: ["당근마켓", "당근"],
    channel: "cta_danggeun",
    isCta: true,
    label: "당근마켓 광고",
  },
  // 일반 광고 키워드 (플랫폼 미특정)
  {
    keywords: ["광고 보고", "광고를 보고", "광고에서", "온라인 광고", "인터넷 광고", "SNS 광고"],
    channel: "cta_other",
    isCta: true,
    label: "기타 광고",
  },
  // 비-CTA 채널
  {
    keywords: ["소개", "추천", "지인", "친구", "가족", "아는"],
    channel: "referral",
    isCta: false,
    label: "지인 소개",
  },
  {
    keywords: ["블로그", "카페", "네이버 검색", "검색해서"],
    channel: "online_search",
    isCta: false,
    label: "온라인 검색",
  },
  {
    keywords: ["지나가다", "근처", "동네", "간판"],
    channel: "walk_in",
    isCta: false,
    label: "도보/간판",
  },
  {
    keywords: ["전화", "통화"],
    channel: "phone",
    isCta: false,
    label: "전화 문의",
  },
];

/**
 * 자유입력 방문 경로 텍스트를 분석하여 채널/CTA 여부를 판정
 */
export function classifySource(rawText: string | null | undefined): ClassifyResult {
  if (!rawText || rawText.trim() === "") {
    return {
      channel: "unknown",
      isCta: false,
      confidence: 0,
      autoReason: "유입 경로 미입력",
    };
  }

  const normalized = rawText.toLowerCase().replace(/\s+/g, " ").trim();

  for (const rule of CHANNEL_RULES) {
    for (const keyword of rule.keywords) {
      if (normalized.includes(keyword.toLowerCase())) {
        return {
          channel: rule.channel,
          isCta: rule.isCta,
          confidence: rule.isCta ? 0.85 : 0.9,
          autoReason: `"${rawText}" → "${keyword}" 키워드 매칭 → ${rule.label}`,
        };
      }
    }
  }

  // 부분 매칭: "광고"라는 단어가 포함되면 CTA 후보로 분류
  if (normalized.includes("광고")) {
    return {
      channel: "cta_other",
      isCta: true,
      confidence: 0.6,
      autoReason: `"${rawText}" → "광고" 키워드 포함 — 구체 플랫폼 미확인, 검토 필요`,
    };
  }

  return {
    channel: "unknown",
    isCta: false,
    confidence: 0.5,
    autoReason: `"${rawText}" → 분류 규칙에 해당하지 않음, 수동 검토 필요`,
  };
}

/**
 * 진료 시작 여부 판정
 * 상담/예약/문의만으로는 인정하지 않음 — 실제 진료 행위가 있어야 함
 */
export function hasTreatmentStarted(procedures: { code: string; name: string }[]): boolean {
  if (!procedures || procedures.length === 0) return false;

  // 상담/검사만 있는 경우는 진료 시작으로 인정하지 않음
  const CONSULTATION_ONLY_CODES = [
    "상담", "초진", "검사", "상담료", "진찰", "consultation",
    "방사선", "파노라마", "X-ray", "CT",
  ];

  const hasRealTreatment = procedures.some((p) => {
    const name = p.name.toLowerCase();
    const code = p.code.toLowerCase();
    return !CONSULTATION_ONLY_CODES.some(
      (c) => name.includes(c.toLowerCase()) || code.includes(c.toLowerCase())
    );
  });

  return hasRealTreatment;
}

/**
 * 정산 대상 월 계산 (YYYY-MM 형식)
 */
export function getSettlementMonth(visitDate: Date): string {
  const y = visitDate.getFullYear();
  const m = String(visitDate.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/**
 * 정산 인정 여부 판정 + 사유
 */
export function evaluateSettlementEligibility(params: {
  reviewStatus: string;
  treatmentStarted: boolean;
  isDuplicate: boolean;
}): { eligible: boolean; reason: string } {
  if (params.reviewStatus === "rejected") {
    return { eligible: false, reason: "검토 결과 반려됨" };
  }
  if (params.reviewStatus === "pending") {
    return { eligible: false, reason: "검토 대기 중" };
  }
  if (!params.treatmentStarted) {
    return { eligible: false, reason: "실제 진료 미시작 (상담/검사만)" };
  }
  if (params.isDuplicate) {
    return { eligible: false, reason: "동일 환자 중복 유입 (1회만 인정)" };
  }
  return { eligible: true, reason: "정산 인정: 확정 + 진료 시작 + 중복 아님" };
}

/**
 * 정산 인정 사유를 사용자 친화적 텍스트로 변환
 */
export function getEligibilityExplanation(params: {
  reviewStatus: string;
  treatmentStarted: boolean;
  isDuplicate: boolean;
  settlementEligible: boolean;
  ineligibleReason: string | null;
}): string[] {
  const lines: string[] = [];

  // 검토 상태
  if (params.reviewStatus === "confirmed") {
    lines.push("광고 유입 확정됨");
  } else if (params.reviewStatus === "rejected") {
    lines.push("광고 유입 반려됨");
  } else {
    lines.push("검토 대기 중");
  }

  // 진료 시작
  if (params.treatmentStarted) {
    lines.push("실제 진료 시작됨");
  } else {
    lines.push("실제 진료 미시작 (상담/검사만)");
  }

  // 중복
  if (params.isDuplicate) {
    lines.push("동일 환자 중복 유입 — 1회만 인정");
  }

  // 최종 판정
  if (params.settlementEligible) {
    lines.push("→ 정산 대상 인정");
  } else {
    lines.push(`→ 정산 미인정: ${params.ineligibleReason || "조건 미충족"}`);
  }

  return lines;
}
