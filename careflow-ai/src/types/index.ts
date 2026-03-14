export type RuleType =
  | "treatment_dropout"
  | "scaling_recall"
  | "implant_followup"
  | "potential_demand";

export type SubType =
  | "nerve_treatment"
  | "prosthetic"
  | "scaling_insurance"
  | "perio_recall"
  | "implant_1m"
  | "implant_3m"
  | "implant_6m"
  | "implant_12m"
  | "wisdom_tooth"
  | "orthodontic";

export type Priority = 1 | 2 | 3 | 4;

export type RecallStatus = "pending" | "contacted" | "completed" | "dismissed";

export type MessageTone = "polite" | "friendly" | "doctor";
export type MessageLength = "short" | "medium" | "long";

export interface DetectionResult {
  patientId: string;
  ruleType: RuleType;
  subType: SubType;
  priority: Priority;
  reason: string;
  evidenceDate: Date | null;
  evidenceDetail: string;
  dueDate?: Date;
}

export interface RuleConfigParams {
  nerve_treatment_days?: number;
  prosthetic_days?: number;
  scaling_months?: number;
  perio_recall_months?: number;
  implant_checkup_months?: number[];
}

export interface DashboardStats {
  todayActionCount: number;
  treatmentDropoutCount: number;
  recallDueCount: number;
  messageSuggestionCount: number;
}

export const RULE_TYPE_LABELS: Record<RuleType, string> = {
  treatment_dropout: "치료 중단 의심",
  scaling_recall: "스케일링/치주 리콜",
  implant_followup: "임플란트 사후관리",
  potential_demand: "잠재 수요",
};

export const SUB_TYPE_LABELS: Record<SubType, string> = {
  nerve_treatment: "신경치료 중단 의심",
  prosthetic: "보철 중단 의심",
  scaling_insurance: "보험 스케일링 안내 대상",
  perio_recall: "치주 정기 리콜 대상",
  implant_1m: "임플란트 1개월 점검",
  implant_3m: "임플란트 3개월 점검",
  implant_6m: "임플란트 6개월 점검",
  implant_12m: "임플란트 12개월 점검",
  wisdom_tooth: "사랑니 발치 잠재 수요",
  orthodontic: "교정 상담 후 미전환",
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  1: "긴급",
  2: "높음",
  3: "보통",
  4: "낮음",
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  1: "bg-red-100 text-red-800",
  2: "bg-orange-100 text-orange-800",
  3: "bg-blue-100 text-blue-800",
  4: "bg-gray-100 text-gray-800",
};

export const STATUS_LABELS: Record<RecallStatus, string> = {
  pending: "대기",
  contacted: "연락 완료",
  completed: "처리 완료",
  dismissed: "제외",
};

export const TONE_LABELS: Record<MessageTone, string> = {
  polite: "정중함",
  friendly: "친근함",
  doctor: "원장 직접 톤",
};

export const LENGTH_LABELS: Record<MessageLength, string> = {
  short: "짧게",
  medium: "보통",
  long: "자세히",
};

// ──────────────────────────────────────────────
// CPA 광고 귀속 추적 타입
// ──────────────────────────────────────────────

export type VisitChannel =
  | "walk_in"
  | "referral"
  | "cta_naver"
  | "cta_google"
  | "cta_kakao"
  | "cta_instagram"
  | "cta_meta"
  | "cta_youtube"
  | "cta_danggeun"
  | "cta_other"
  | "online_search"
  | "online"
  | "phone"
  | "unknown"
  | "other";

export type AttributionReviewStatus = "pending" | "confirmed" | "rejected";
export type CampaignStatus = "active" | "paused" | "ended";

export type MessageDeliveryStatus = "queued" | "sending" | "sent" | "failed" | "cancelled";

export const CHANNEL_LABELS: Record<string, string> = {
  walk_in: "직접 방문",
  referral: "지인 소개",
  cta_naver: "네이버 광고",
  cta_google: "구글 광고",
  cta_kakao: "카카오 광고",
  cta_instagram: "인스타그램 광고",
  cta_meta: "메타/페이스북 광고",
  cta_youtube: "유튜브 광고",
  cta_danggeun: "당근마켓 광고",
  cta_other: "기타 광고",
  online_search: "온라인 검색",
  online: "온라인 예약",
  phone: "전화 문의",
  unknown: "미분류",
  other: "기타",
};

export const REVIEW_STATUS_LABELS: Record<AttributionReviewStatus, string> = {
  pending: "검토 필요",
  confirmed: "확정",
  rejected: "반려",
};

export const REVIEW_STATUS_COLORS: Record<AttributionReviewStatus, string> = {
  pending: "bg-amber-100 text-amber-700 border-amber-200",
  confirmed: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-gray-100 text-gray-500 border-gray-200",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  active: "진행 중",
  paused: "일시중지",
  ended: "종료",
};

export const DELIVERY_STATUS_LABELS: Record<MessageDeliveryStatus, string> = {
  queued: "발송 대기",
  sending: "발송 중",
  sent: "발송 완료",
  failed: "발송 실패",
  cancelled: "취소",
};

export const DELIVERY_STATUS_COLORS: Record<MessageDeliveryStatus, string> = {
  queued: "bg-blue-100 text-blue-700",
  sending: "bg-yellow-100 text-yellow-700",
  sent: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

// ──────────────────────────────────────────────
// 업무 처리 흐름 (Workflow) 타입
// ──────────────────────────────────────────────

export type TaskStatus =
  | "unprocessed"
  | "reviewing"
  | "waiting_contact"
  | "on_hold"
  | "excluded"
  | "completed"
  | "recheck_scheduled";

export type ActionType =
  | "CTA_REVIEW"
  | "RECALL"
  | "CHURN_REENGAGE"
  | "MESSAGE_REVIEW"
  | "PERIO_RECALL"
  | "IMPLANT_FOLLOWUP"
  | "GENERAL";

export type StaffRole = "desk" | "counselor" | "doctor" | "manager";

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  unprocessed: "미처리",
  reviewing: "검토중",
  waiting_contact: "연락 대기",
  on_hold: "보류",
  excluded: "제외",
  completed: "완료",
  recheck_scheduled: "재확인 예정",
};

export const TASK_STATUS_COLORS: Record<TaskStatus, string> = {
  unprocessed: "bg-gray-100 text-gray-700 border-gray-200",
  reviewing: "bg-blue-100 text-blue-700 border-blue-200",
  waiting_contact: "bg-yellow-100 text-yellow-700 border-yellow-200",
  on_hold: "bg-orange-100 text-orange-700 border-orange-200",
  excluded: "bg-gray-100 text-gray-400 border-gray-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  recheck_scheduled: "bg-purple-100 text-purple-700 border-purple-200",
};

export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  CTA_REVIEW: "CPA 유입 검토",
  RECALL: "리콜 연락",
  CHURN_REENGAGE: "치료 중단 복귀",
  MESSAGE_REVIEW: "메시지 발송 검토",
  PERIO_RECALL: "치주 정기 리콜",
  IMPLANT_FOLLOWUP: "임플란트 점검",
  GENERAL: "일반 업무",
};

export const ACTION_TYPE_COLORS: Record<ActionType, string> = {
  CTA_REVIEW: "bg-green-100 text-green-700 border-green-200",
  RECALL: "bg-amber-100 text-amber-700 border-amber-200",
  CHURN_REENGAGE: "bg-red-100 text-red-700 border-red-200",
  MESSAGE_REVIEW: "bg-blue-100 text-blue-700 border-blue-200",
  PERIO_RECALL: "bg-orange-100 text-orange-700 border-orange-200",
  IMPLANT_FOLLOWUP: "bg-indigo-100 text-indigo-700 border-indigo-200",
  GENERAL: "bg-gray-100 text-gray-700 border-gray-200",
};

export const STAFF_ROLE_LABELS: Record<StaffRole, string> = {
  desk: "데스크",
  counselor: "상담실장",
  doctor: "원장",
  manager: "관리자",
};

export const VALID_TASK_STATUSES: TaskStatus[] = [
  "unprocessed", "reviewing", "waiting_contact", "on_hold",
  "excluded", "completed", "recheck_scheduled",
];

export const VALID_ACTION_TYPES: ActionType[] = [
  "CTA_REVIEW", "RECALL", "CHURN_REENGAGE", "MESSAGE_REVIEW",
  "PERIO_RECALL", "IMPLANT_FOLLOWUP", "GENERAL",
];
