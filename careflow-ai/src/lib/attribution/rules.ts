/**
 * 방문경로 분류 사전 (Source Rule Dictionary)
 *
 * DB에 저장된 SourceRule 테이블을 기반으로 매칭하되,
 * DB가 비어있거나 접근 불가능한 경우 이 기본 규칙을 fallback으로 사용.
 */

export interface SourceRuleDefinition {
  ruleName: string;
  keywords: string[];
  normalizedSource: string;
  sourceCategory: string;
  ctaCandidate: boolean;
  priority: number;
  isActive: boolean;
  description: string;
}

/** 소스 카테고리 목록 */
export const SOURCE_CATEGORIES = [
  "Search Ads",
  "SNS",
  "Display Ads",
  "Referral",
  "Organic Search",
  "Offline",
  "Phone",
  "Unknown",
] as const;

export type SourceCategory = (typeof SOURCE_CATEGORIES)[number];

/** 기본 분류 규칙 사전 (DB fallback + 시드 데이터 소스) */
export const DEFAULT_SOURCE_RULES: SourceRuleDefinition[] = [
  // ── CTA 광고 채널 ──
  {
    ruleName: "naver_search_ads",
    keywords: ["네이버 광고", "네이버광고", "네이버 검색광고", "파워링크", "네이버 플레이스 광고", "naver ads"],
    normalizedSource: "Naver Search Ads",
    sourceCategory: "Search Ads",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "네이버 검색 광고 (파워링크, 플레이스 광고 포함)",
  },
  {
    ruleName: "google_ads",
    keywords: ["구글 광고", "구글광고", "구글 검색", "구글 애즈", "google ads", "구글에서 광고"],
    normalizedSource: "Google Ads",
    sourceCategory: "Search Ads",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "구글 검색 광고 (Google Ads)",
  },
  {
    ruleName: "kakao_ads",
    keywords: ["카카오 광고", "카카오모먼트", "카카오 비즈보드", "카톡 광고", "카카오톡 광고"],
    normalizedSource: "Kakao Ads",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "카카오 광고 (비즈보드, 카카오모먼트)",
  },
  {
    ruleName: "kakao_channel",
    keywords: ["카카오 채널", "카톡 플친", "카카오 플러스친구", "카톡 채널", "플친"],
    normalizedSource: "Kakao Channel",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 15,
    isActive: true,
    description: "카카오 채널/플러스친구 유입",
  },
  {
    ruleName: "instagram_ads",
    keywords: ["인스타 광고", "인스타그램 광고", "인스타 릴스", "인스타 스토리 광고", "인스타 DM"],
    normalizedSource: "Instagram Ads",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "인스타그램 광고 (릴스, 스토리, DM 포함)",
  },
  {
    ruleName: "instagram_organic",
    keywords: ["인스타", "인스타그램", "instagram", "insta"],
    normalizedSource: "Instagram",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 20,
    isActive: true,
    description: "인스타그램 일반 유입 (광고/오가닉 구분 불분명)",
  },
  {
    ruleName: "meta_ads",
    keywords: ["페이스북", "facebook", "fb 광고", "메타 광고", "meta ads"],
    normalizedSource: "Meta/Facebook Ads",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "메타/페이스북 광고",
  },
  {
    ruleName: "youtube_ads",
    keywords: ["유튜브 광고", "youtube 광고", "유튜브에서"],
    normalizedSource: "YouTube Ads",
    sourceCategory: "Display Ads",
    ctaCandidate: true,
    priority: 10,
    isActive: true,
    description: "유튜브 광고",
  },
  {
    ruleName: "danggeun_ads",
    keywords: ["당근마켓", "당근", "당근에서"],
    normalizedSource: "Danggeun Market",
    sourceCategory: "SNS",
    ctaCandidate: true,
    priority: 15,
    isActive: true,
    description: "당근마켓 광고",
  },
  {
    ruleName: "generic_online_ads",
    keywords: ["온라인 광고", "인터넷 광고", "SNS 광고", "광고 보고", "광고를 보고", "광고에서"],
    normalizedSource: "Online Ads (Unspecified)",
    sourceCategory: "Display Ads",
    ctaCandidate: true,
    priority: 50,
    isActive: true,
    description: "플랫폼 미특정 온라인 광고 (검토 필요)",
  },
  // ── 비-CTA 채널 ──
  {
    ruleName: "referral",
    keywords: ["지인 소개", "추천", "소개받고", "소개로", "친구 소개", "가족 소개", "아는 사람"],
    normalizedSource: "Referral",
    sourceCategory: "Referral",
    ctaCandidate: false,
    priority: 30,
    isActive: true,
    description: "지인/가족/친구 소개",
  },
  {
    ruleName: "naver_blog_search",
    keywords: ["블로그", "네이버 블로그", "네이버 검색", "검색해서", "검색하다"],
    normalizedSource: "Naver Blog/Search",
    sourceCategory: "Organic Search",
    ctaCandidate: false,
    priority: 30,
    isActive: true,
    description: "네이버 블로그/검색 유입 (광고 아님)",
  },
  {
    ruleName: "naver_place",
    keywords: ["네이버 플레이스", "네이버 지도", "지도에서"],
    normalizedSource: "Naver Place",
    sourceCategory: "Organic Search",
    ctaCandidate: false,
    priority: 25,
    isActive: true,
    description: "네이버 플레이스/지도 검색 유입",
  },
  {
    ruleName: "walk_in",
    keywords: ["지나가다", "근처", "동네", "간판", "간판 보고", "앞에서"],
    normalizedSource: "Walk-in",
    sourceCategory: "Offline",
    ctaCandidate: false,
    priority: 40,
    isActive: true,
    description: "도보/간판 유입",
  },
  {
    ruleName: "phone_inquiry",
    keywords: ["전화", "통화", "전화로"],
    normalizedSource: "Phone Inquiry",
    sourceCategory: "Phone",
    ctaCandidate: false,
    priority: 40,
    isActive: true,
    description: "전화 문의",
  },
  {
    ruleName: "online_booking",
    keywords: ["온라인 예약", "네이버 예약", "예약 사이트"],
    normalizedSource: "Online Booking",
    sourceCategory: "Organic Search",
    ctaCandidate: false,
    priority: 35,
    isActive: true,
    description: "온라인 예약 플랫폼",
  },
];

/** 카테고리 한국어 라벨 */
export const CATEGORY_LABELS: Record<string, string> = {
  "Search Ads": "검색 광고",
  SNS: "SNS 광고",
  "Display Ads": "디스플레이 광고",
  Referral: "지인 소개",
  "Organic Search": "자연 검색",
  Offline: "오프라인",
  Phone: "전화",
  Unknown: "미분류",
};

/** 신뢰도 한국어 라벨 */
export const CONFIDENCE_LABELS: Record<string, string> = {
  HIGH: "높음",
  MEDIUM: "보통",
  LOW: "낮음",
};

export const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: "bg-green-100 text-green-700",
  MEDIUM: "bg-amber-100 text-amber-700",
  LOW: "bg-red-100 text-red-700",
};
