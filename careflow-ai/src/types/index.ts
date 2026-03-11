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
