/**
 * AI 메시지 생성 프롬프트 모듈
 *
 * 프롬프트는 별도 모듈로 분리하여 관리합니다.
 * tone, purpose, 환자 컨텍스트에 따라 프롬프트가 달라집니다.
 */

import { MessageGenerationInput } from "./provider";

const TONE_INSTRUCTIONS: Record<string, string> = {
  polite: "정중하고 격식 있는 톤으로 작성하세요. 존댓말을 사용하고, 병원의 전문성이 느껴지는 문체를 사용합니다.",
  friendly: "친근하고 따뜻한 톤으로 작성하세요. 부드러운 존댓말을 사용하되, 딱딱하지 않게 합니다. 이모지 사용은 1개 이내.",
  doctor: "원장이 직접 보내는 톤으로 작성하세요. 전문적이면서도 환자에 대한 관심이 느껴지는 문체입니다.",
};

const PURPOSE_INSTRUCTIONS: Record<string, string> = {
  recall: "정기 검진/리콜 안내 메시지입니다. 환자의 건강 관리를 위한 정기적 방문의 중요성을 자연스럽게 전달합니다.",
  greeting: "안부 인사 겸 내원 안내 메시지입니다. 오랜만에 연락하는 느낌으로, 부담 없이 작성합니다.",
  treatment_return: "중단된 치료의 재개를 안내하는 메시지입니다. 치료 완료의 중요성을 부드럽게 전달하되, 강요하지 않습니다.",
};

export function buildMessagePrompt(input: MessageGenerationInput): string {
  const toneInstruction = TONE_INSTRUCTIONS[input.tone] || TONE_INSTRUCTIONS.polite;
  const purposeInstruction = PURPOSE_INSTRUCTIONS[input.purpose] || PURPOSE_INSTRUCTIONS.recall;

  return `당신은 한국의 치과/병원에서 환자에게 보내는 안내 문자 메시지를 작성하는 전문가입니다.

## 역할
- 병원 운영팀이 환자에게 보내는 안내 문자의 초안을 작성합니다.
- 이것은 '운영 보조용 커뮤니케이션 초안'이지, 의료적 판단이나 진단이 아닙니다.

## 절대 규칙
1. "진단", "확정", "반드시 치료하셔야", "위험합니다", "심각한" 같은 과도한 의료적 표현을 절대 사용하지 마세요.
2. 광고성 문구, 과장된 표현, 불안을 조장하는 표현을 절대 사용하지 마세요.
3. 의료적 판단이나 진단처럼 보이는 문장을 절대 작성하지 마세요.
4. 환자의 프라이버시를 존중하세요. 구체적인 질환명이나 상세 치료 내용을 문자에 직접 노출하지 마세요.
5. 자연스럽고 공손한 한국어를 사용하세요.

## 톤
${toneInstruction}

## 목적
${purposeInstruction}

## 환자 정보
- 환자명: ${input.patientName}님
- 최근 방문일: ${input.recentVisitDate}
- 안내 사유: ${input.recallReason}
- 권장 액션: ${input.recommendedAction}
${input.additionalContext ? `- 추가 정보: ${input.additionalContext}` : ""}

## 출력 형식
아래 JSON 형식으로 정확히 3가지 버전의 메시지를 작성하세요:

\`\`\`json
{
  "shortMessage": "(80자 이내, SMS용 짧은 버전)",
  "standardMessage": "(150자 내외, 기본 안내 버전)",
  "warmMessage": "(200자 내외, 좀 더 따뜻하고 관심이 느껴지는 버전)"
}
\`\`\`

메시지 마지막에는 병원명을 포함하세요 (예: "OO치과 드림").
JSON만 출력하고 다른 텍스트는 포함하지 마세요.`;
}

/**
 * 리콜 사유별 권장 액션 매핑
 */
export function getRecommendedAction(subType: string): string {
  const actions: Record<string, string> = {
    nerve_treatment: "진행 중이던 치료 마무리를 위한 내원",
    prosthetic: "보철 최종 장착을 위한 내원",
    scaling_insurance: "올해 보험 스케일링 수진",
    perio_recall: "잇몸 상태 정기 확인",
    implant_1m: "임플란트 1개월 점검",
    implant_3m: "임플란트 3개월 점검",
    implant_6m: "임플란트 6개월 점검",
    implant_12m: "임플란트 1년 점검",
    wisdom_tooth: "사랑니 관련 상담",
    orthodontic: "교정 관련 재상담",
  };
  return actions[subType] || "정기 검진";
}

/**
 * 리콜 사유별 메시지 목적 매핑
 */
export function getPurposeFromSubType(subType: string): "recall" | "greeting" | "treatment_return" {
  if (subType === "nerve_treatment" || subType === "prosthetic") {
    return "treatment_return";
  }
  if (subType === "wisdom_tooth" || subType === "orthodontic") {
    return "greeting";
  }
  return "recall";
}
