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
import { validateAIOutput } from "./validate-output";
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

/** 마지막 생성의 fallback 정보 (메트릭 수집용) */
export interface GenerationContext {
  generatedBy: string;
  subType: string;
  fallbackReason?: string;
}

let _lastGenerationContext: GenerationContext | null = null;

/** 마지막 생성 컨텍스트 조회 (메트릭 로깅용) */
export function getLastGenerationContext(): GenerationContext | null {
  return _lastGenerationContext;
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
        // AI 출력 후처리 검증
        const validation = validateAIOutput(result);
        if (validation.issues.length > 0) {
          console.log(`[CareFlow] AI 출력 검증: ${validation.issues.join(", ")}`);
        }
        if (!validation.valid) {
          console.log("[CareFlow] AI 출력 검증 실패, 템플릿으로 전환합니다.");
          _lastGenerationContext = { generatedBy: "fallback", subType: detection.subType, fallbackReason: "validation_failed" };
          throw new Error("AI 출력 검증 실패");
        }
        if (validation.corrected) {
          console.log("[CareFlow] AI 출력 자동 보정 적용");
          _lastGenerationContext = { generatedBy: result.generatedBy, subType: detection.subType };
          return { ...validation.messages, generatedBy: result.generatedBy };
        }
        console.log("[CareFlow] AI 메시지 생성 완료");
        _lastGenerationContext = { generatedBy: result.generatedBy, subType: detection.subType };
        return result;
      }
      console.log("[CareFlow] AI 프로바이더 미설정, 템플릿으로 전환합니다.");
      _lastGenerationContext = { generatedBy: "template", subType: detection.subType, fallbackReason: "provider_unavailable" };
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      const fallbackReason = classifyFallbackReason(errMsg);
      _lastGenerationContext = { generatedBy: "fallback", subType: detection.subType, fallbackReason };
      console.log(`[CareFlow] AI 메시지 생성 실패 (${fallbackReason}), 템플릿으로 전환합니다.`);
    }
  } else {
    _lastGenerationContext = { generatedBy: "template", subType: detection.subType };
  }

  // Fallback: 템플릿 기반 생성
  try {
    const result = await templateProvider.generate(input);
    if (provider.name !== "template") {
      return { ...result, generatedBy: "fallback" };
    }
    return result;
  } catch (error) {
    console.error("[CareFlow] 템플릿 메시지 생성도 실패:", error);
    _lastGenerationContext = { generatedBy: "fallback", subType: detection.subType, fallbackReason: "template_error" };
    return {
      shortMessage: `${patientName}님 안녕하세요. 정기 검진 안내드립니다.`,
      standardMessage: `안녕하세요, ${patientName}님. 건강한 치아 관리를 위해 내원을 안내드립니다. 편하신 시간에 연락 주세요.`,
      warmMessage: `${patientName}님, 안녕하세요. 지난번 방문 이후 ${patientName}님의 건강이 궁금하여 연락드립니다. 편하실 때 내원하시면 상태를 확인해 드리겠습니다. CareFlow 치과 드림`,
      generatedBy: "fallback",
    };
  }
}

/** 에러 메시지 → fallback 원인 분류 */
function classifyFallbackReason(errMsg: string): string {
  if (errMsg.includes("타임아웃") || errMsg.includes("AbortError")) return "timeout";
  if (errMsg.includes("인증") || errMsg.includes("401") || errMsg.includes("403")) return "auth_error";
  if (errMsg.includes("429") || errMsg.includes("한도 초과")) return "rate_limit";
  if (errMsg.includes("안전 필터") || errMsg.includes("SAFETY")) return "safety_filter";
  if (errMsg.includes("JSON") || errMsg.includes("필드 누락")) return "parse_error";
  if (errMsg.includes("검증 실패")) return "validation_failed";
  if (errMsg.includes("서버 오류") || errMsg.includes("5")) return "server_error";
  return "unknown";
}
