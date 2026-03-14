/**
 * 메시지 생성 오케스트레이터
 *
 * 설정에 따라 적절한 프로바이더를 선택하고,
 * 실패 시 자동으로 fallback합니다.
 */

import {
  AIProvider,
  MessageGenerationInput,
  GeneratedMessages,
  getDefaultAIConfig,
} from "./provider";
import { GeminiProvider } from "./gemini";
import { TemplateFallbackProvider } from "./template-fallback";
import { getRecommendedAction, getPurposeFromSubType } from "./prompts";
import { DetectionResult, MessageTone } from "@/types";

const templateProvider = new TemplateFallbackProvider();

function getAIProvider(): AIProvider {
  const config = getDefaultAIConfig();
  if (config.enabled) {
    return new GeminiProvider(config);
  }
  return templateProvider;
}

export interface GenerateMessageOptions {
  patientName: string;
  detection: DetectionResult;
  tone: MessageTone;
  recentVisitDate?: string;
  additionalContext?: string;
}

export async function generateMessages(
  options: GenerateMessageOptions
): Promise<GeneratedMessages> {
  const { patientName, detection, tone, recentVisitDate, additionalContext } = options;

  const input: MessageGenerationInput = {
    patientName,
    recentVisitDate: recentVisitDate || "최근",
    recallReason: detection.reason,
    recallSubType: detection.subType,
    recommendedAction: getRecommendedAction(detection.subType),
    tone,
    purpose: getPurposeFromSubType(detection.subType),
    additionalContext,
  };

  const provider = getAIProvider();

  // AI 프로바이더 시도
  if (provider.name !== "template") {
    try {
      const isAvailable = await provider.isAvailable();
      if (isAvailable) {
        const result = await provider.generate(input);
        console.log("[CareFlow] AI 메시지 생성 완료");
        return result;
      }
      console.log("[CareFlow] AI 프로바이더 미설정, 템플릿으로 전환합니다.");
    } catch (err) {
      // 상세 에러는 gemini.ts에서 이미 console.error로 기록됨
      // 여기서는 fallback 전환 사실만 기록
      console.log("[CareFlow] AI 메시지 생성 실패, 템플릿으로 전환합니다.");
    }
  }

  // Fallback: 템플릿 기반 생성
  try {
    const result = await templateProvider.generate(input);
    if (provider.name !== "template") {
      // AI에서 fallback한 경우
      return { ...result, generatedBy: "fallback" };
    }
    return result;
  } catch (error) {
    console.error("[CareFlow] 템플릿 메시지 생성도 실패:", error);
    // 최종 fallback: 기본 메시지
    return {
      shortMessage: `${patientName}님 안녕하세요. 정기 검진 안내드립니다.`,
      standardMessage: `안녕하세요, ${patientName}님. 건강한 치아 관리를 위해 내원을 안내드립니다. 편하신 시간에 연락 주세요.`,
      warmMessage: `${patientName}님, 안녕하세요. 지난번 방문 이후 ${patientName}님의 건강이 궁금하여 연락드립니다. 편하실 때 내원하시면 상태를 확인해 드리겠습니다. CareFlow 치과 드림`,
      generatedBy: "fallback",
    };
  }
}
