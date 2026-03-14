/**
 * AI 메시지 생성 프로바이더 인터페이스
 *
 * 모든 LLM 프로바이더는 이 인터페이스를 구현합니다.
 * 프로바이더 교체/추가 시 이 인터페이스만 구현하면 됩니다.
 */

export interface MessageGenerationInput {
  patientName: string;
  recentVisitDate: string;
  recallReason: string;
  recallSubType: string;
  recommendedAction: string;
  tone: "polite" | "friendly" | "doctor";
  purpose: "recall" | "greeting" | "treatment_return";
  additionalContext?: string;
}

export interface GeneratedMessages {
  shortMessage: string;    // SMS 길이 (80자 내외)
  standardMessage: string; // 기본 버전 (150자 내외)
  warmMessage: string;     // 따뜻한 버전 (200자 내외)
  safetyNotes?: string;    // 안전 관련 참고 사항
  generatedBy: "gemini" | "template" | "fallback";
}

export interface AIProvider {
  name: string;
  generate(input: MessageGenerationInput): Promise<GeneratedMessages>;
  isAvailable(): Promise<boolean>;
}

export interface AIProviderConfig {
  provider: string;
  modelName: string;
  temperature: number;
  maxOutputTokens: number;
  enabled: boolean;
}

export function getDefaultAIConfig(): AIProviderConfig {
  return {
    provider: "gemini",
    modelName: process.env.GEMINI_MODEL || "gemini-3.1-pro-preview",
    temperature: 0.7,
    maxOutputTokens: 1024,
    enabled: process.env.ENABLE_LLM_MESSAGE_GENERATION === "true",
  };
}
