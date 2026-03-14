/**
 * 메시지 유형별 정책 정의
 *
 * 각 메시지 유형(치료 중단, 장기 미내원, 상담 후 미예약, 시술 후 경과 확인)에 대해
 * 프롬프트 규칙, 길이 제한, CTA 텍스트, 금지 표현, 기본 템플릿을 정의합니다.
 */

export interface MessagePolicy {
  /** 정책 유형 식별자 */
  type: string;
  /** 한국어 이름 */
  label: string;
  /** 프롬프트에 추가할 유형별 지침 */
  promptGuidelines: string;
  /** 메시지별 길이 제한 (글자 수) */
  lengthLimits: {
    short: { min: number; max: number };
    standard: { min: number; max: number };
    warm: { min: number; max: number };
  };
  /** 권장 CTA 문구 */
  ctaTemplates: string[];
  /** 유형별 추가 금지 표현 */
  bannedExpressions: string[];
  /** 템플릿 fallback용 기본 메시지 */
  defaultTemplates: {
    short: string;
    standard: string;
    warm: string;
  };
}

export const MESSAGE_POLICIES: Record<string, MessagePolicy> = {
  treatment_dropout: {
    type: "treatment_dropout",
    label: "치료 중단",
    promptGuidelines: [
      "치료를 중단한 환자에게 보내는 메시지입니다.",
      "치료 완료의 중요성을 부드럽게 전달하되, '방치하면 악화' 같은 공포 유도 표현을 절대 사용하지 마세요.",
      "환자가 치료를 중단한 이유(비용, 시간, 통증 등)를 이해하는 듯한 공감 표현을 포함하세요.",
      "'마무리만 남았습니다', '조금만 더 하시면 됩니다' 같은 격려 표현을 사용하세요.",
    ].join("\n"),
    lengthLimits: {
      short: { min: 15, max: 80 },
      standard: { min: 40, max: 150 },
      warm: { min: 60, max: 200 },
    },
    ctaTemplates: [
      "편하신 시간에 연락 주세요",
      "이어서 진행하실 수 있도록 예약 도와드리겠습니다",
    ],
    bannedExpressions: [
      "방치",
      "악화",
      "위험",
      "감염",
      "발치",
      "심각",
    ],
    defaultTemplates: {
      short: "{name}님, 진행 중이던 치료 마무리 안내드립니다. 편하실 때 연락 주세요.",
      standard: "안녕하세요, {name}님. 이전에 진행하셨던 치료가 마무리 단계에 있어 안내드립니다. 편하신 시간에 내원하시면 이어서 진행해 드리겠습니다. {clinic} 드림",
      warm: "{name}님, 안녕하세요. 지난번 치료 이후 불편하신 곳은 없으신지 궁금합니다. 남은 과정이 많지 않으니, 편하실 때 한 번 들러주시면 마무리해 드리겠습니다. {clinic} 드림",
    },
  },

  long_absence: {
    type: "long_absence",
    label: "장기 미내원",
    promptGuidelines: [
      "오랜 기간 방문하지 않은 환자에게 보내는 안부 겸 내원 안내 메시지입니다.",
      "부담 없이 '안부 인사' 느낌으로 작성하세요. 치료가 필요하다는 톤은 피하세요.",
      "'정기 확인', '건강 관리' 같은 일반적 표현을 사용하세요.",
      "환자를 기억하고 있다는 느낌을 자연스럽게 전달하세요.",
    ].join("\n"),
    lengthLimits: {
      short: { min: 15, max: 80 },
      standard: { min: 40, max: 150 },
      warm: { min: 60, max: 200 },
    },
    ctaTemplates: [
      "편하실 때 한 번 들러주세요",
      "정기 검진 예약은 전화 한 통이면 됩니다",
    ],
    bannedExpressions: [
      "오래되어",
      "방치",
      "악화",
      "놓치",
      "잊으셨",
    ],
    defaultTemplates: {
      short: "{name}님, 안녕하세요. 정기 검진 안내드립니다. 편하실 때 연락 주세요.",
      standard: "안녕하세요, {name}님. 건강한 치아 관리를 위해 정기 검진 안내드립니다. 편하신 시간에 방문해 주시면 상태 확인해 드리겠습니다. {clinic} 드림",
      warm: "{name}님, 안녕하세요. 지난번 방문 이후 건강은 잘 지내고 계신지 궁금합니다. 정기적으로 상태를 확인하시면 더 편안하게 관리하실 수 있습니다. 편하실 때 한 번 들러주세요. {clinic} 드림",
    },
  },

  post_consultation: {
    type: "post_consultation",
    label: "상담 후 미예약",
    promptGuidelines: [
      "상담을 받았으나 아직 예약하지 않은 환자에게 보내는 메시지입니다.",
      "상담 내용을 구체적으로 언급하지 마세요 (프라이버시).",
      "'궁금한 점이 있으시면', '추가 상담도 가능합니다' 같은 열린 표현을 사용하세요.",
      "결정을 재촉하지 말고, 환자의 결정을 존중하는 톤을 유지하세요.",
    ].join("\n"),
    lengthLimits: {
      short: { min: 15, max: 80 },
      standard: { min: 40, max: 150 },
      warm: { min: 60, max: 200 },
    },
    ctaTemplates: [
      "궁금한 점이 있으시면 편하게 문의 주세요",
      "추가 상담도 언제든 가능합니다",
    ],
    bannedExpressions: [
      "빨리",
      "서두르",
      "지금 바로",
      "놓치",
      "마감",
    ],
    defaultTemplates: {
      short: "{name}님, 지난 상담 관련 추가 문의 있으시면 편하게 연락 주세요.",
      standard: "안녕하세요, {name}님. 지난번 상담 이후 궁금하신 점이 있으시면 언제든 문의해 주세요. 추가 상담도 가능합니다. {clinic} 드림",
      warm: "{name}님, 안녕하세요. 지난번 상담 내용 관련해서 혹시 더 궁금하신 점이 있으실까 해서 연락드립니다. 충분히 고민하신 후 결정하셔도 되니, 편하실 때 연락 주세요. {clinic} 드림",
    },
  },

  post_procedure: {
    type: "post_procedure",
    label: "시술 후 경과 확인",
    promptGuidelines: [
      "시술/치료 후 경과 확인을 위한 메시지입니다.",
      "시술명을 구체적으로 언급하지 마세요. '지난 시술', '이전 치료' 정도로 표현하세요.",
      "'경과 확인', '상태 점검' 같은 중립적 표현을 사용하세요.",
      "'문제가 있을 수 있으니' 같은 불안 유발 표현을 피하세요.",
    ].join("\n"),
    lengthLimits: {
      short: { min: 15, max: 80 },
      standard: { min: 40, max: 150 },
      warm: { min: 60, max: 200 },
    },
    ctaTemplates: [
      "경과 확인차 내원해 주세요",
      "편하신 시간에 방문해 주시면 점검해 드리겠습니다",
    ],
    bannedExpressions: [
      "부작용",
      "합병증",
      "감염",
      "위험",
      "문제가",
    ],
    defaultTemplates: {
      short: "{name}님, 이전 시술 경과 확인 안내드립니다. 편하실 때 내원해 주세요.",
      standard: "안녕하세요, {name}님. 지난 시술 후 경과를 확인할 시기가 되어 안내드립니다. 편하신 시간에 방문해 주시면 상태를 점검해 드리겠습니다. {clinic} 드림",
      warm: "{name}님, 안녕하세요. 지난번 치료 이후 불편한 점은 없으신지 궁금합니다. 경과를 한 번 확인해 드리면 더 안심하실 수 있으니, 편하실 때 들러주세요. {clinic} 드림",
    },
  },
};

/**
 * subType → 메시지 정책 매핑
 */
export function getPolicyForSubType(subType: string): MessagePolicy {
  switch (subType) {
    case "nerve_treatment":
    case "prosthetic":
      return MESSAGE_POLICIES.treatment_dropout;
    case "implant_1m":
    case "implant_3m":
    case "implant_6m":
    case "implant_12m":
      return MESSAGE_POLICIES.post_procedure;
    case "wisdom_tooth":
    case "orthodontic":
      return MESSAGE_POLICIES.post_consultation;
    case "scaling_insurance":
    case "perio_recall":
    default:
      return MESSAGE_POLICIES.long_absence;
  }
}
