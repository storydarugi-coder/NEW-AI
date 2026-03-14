/**
 * AI 메시지 생성 프로바이더 (Google AI Studio / Gemini API)
 *
 * 서버 전용 모듈 — 클라이언트에서 직접 호출하지 않습니다.
 * GEMINI_API_KEY 환경변수가 필요합니다.
 * 모델명/프로바이더명은 사용자 UI에 노출하지 않습니다.
 *
 * 엔드포인트: https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 */

import {
  AIProvider,
  MessageGenerationInput,
  GeneratedMessages,
  AIProviderConfig,
} from "./provider";
import { buildMessagePrompt } from "./prompts";

/** AI API 호출 타임아웃 (밀리초) */
const API_TIMEOUT_MS = 15_000;

export class GeminiProvider implements AIProvider {
  name = "gemini";

  private config: AIProviderConfig;
  private apiKey: string;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.apiKey = process.env.GEMINI_API_KEY || "";
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.apiKey) return false;
    return true;
  }

  async generate(input: MessageGenerationInput): Promise<GeneratedMessages> {
    const prompt = buildMessagePrompt(input);

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${this.config.modelName}:generateContent?key=${this.apiKey}`;

    // 타임아웃 적용
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: this.config.temperature,
            maxOutputTokens: this.config.maxOutputTokens,
            responseMimeType: "application/json",
          },
          safetySettings: [
            {
              category: "HARM_CATEGORY_DANGEROUS_CONTENT",
              threshold: "BLOCK_MEDIUM_AND_ABOVE",
            },
          ],
        }),
        signal: controller.signal,
      });
    } catch (err) {
      // 네트워크 에러 또는 타임아웃 — 내부 로그만 남기고 일반 에러로 throw
      const isTimeout = err instanceof DOMException && err.name === "AbortError";
      console.error(`[CareFlow-AI] API 호출 실패: ${isTimeout ? "타임아웃" : "네트워크 에러"}`);
      throw new Error("AI 서비스에 연결할 수 없습니다.");
    } finally {
      clearTimeout(timeoutId);
    }

    // HTTP 에러 처리 — 상태코드별 내부 로그, 사용자에게는 일반 메시지
    if (!response.ok) {
      const status = response.status;
      const errorBody = await response.text().catch(() => "(응답 본문 읽기 실패)");

      if (status === 401 || status === 403) {
        console.error(`[CareFlow-AI] 인증 오류 (${status}): API 키를 확인하세요.`);
      } else if (status === 429) {
        console.error(`[CareFlow-AI] 요청 한도 초과 (429): 잠시 후 다시 시도하세요.`);
      } else if (status >= 500) {
        console.error(`[CareFlow-AI] 서버 오류 (${status}): ${errorBody.slice(0, 150)}`);
      } else {
        console.error(`[CareFlow-AI] API 오류 (${status}): ${errorBody.slice(0, 150)}`);
      }

      throw new Error("AI 메시지 생성에 실패했습니다.");
    }

    // 응답 파싱
    let data: Record<string, unknown>;
    try {
      data = await response.json();
    } catch {
      console.error("[CareFlow-AI] 응답 JSON 파싱 실패");
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    // 안전 필터에 의한 차단 감지
    const candidates = data.candidates as Array<Record<string, unknown>> | undefined;
    if (!candidates || candidates.length === 0) {
      const blockReason = (data.promptFeedback as Record<string, unknown>)?.blockReason;
      if (blockReason) {
        console.error(`[CareFlow-AI] 안전 필터 차단: ${blockReason}`);
      } else {
        console.error("[CareFlow-AI] AI 응답에 후보가 없습니다.");
      }
      throw new Error("AI 메시지를 생성할 수 없습니다.");
    }

    // finishReason 확인 (SAFETY 차단)
    const finishReason = candidates[0].finishReason as string | undefined;
    if (finishReason === "SAFETY") {
      console.error("[CareFlow-AI] 응답이 안전 필터에 의해 차단되었습니다.");
      throw new Error("AI 메시지를 생성할 수 없습니다.");
    }

    // 텍스트 추출
    const content = candidates[0].content as Record<string, unknown> | undefined;
    const parts = (content?.parts as Array<Record<string, unknown>>) || [];
    const text = parts[0]?.text as string | undefined;
    if (!text) {
      console.error("[CareFlow-AI] 응답에서 텍스트를 추출할 수 없습니다.");
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    // JSON 파싱 + 필드 검증
    const parsed = this.parseResponse(text);

    return {
      ...parsed,
      generatedBy: "gemini",
    };
  }

  private parseResponse(text: string): Omit<GeneratedMessages, "generatedBy"> {
    // JSON 블록 추출 (```json ... ``` 형식도 처리)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("[CareFlow-AI] 응답에서 JSON을 찾을 수 없습니다:", text.slice(0, 100));
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch {
      console.error("[CareFlow-AI] JSON 파싱 실패:", jsonMatch[0].slice(0, 100));
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    if (!parsed.shortMessage || !parsed.standardMessage || !parsed.warmMessage) {
      console.error("[CareFlow-AI] 필수 필드 누락:", Object.keys(parsed).join(", "));
      throw new Error("AI 응답을 처리할 수 없습니다.");
    }

    return {
      shortMessage: String(parsed.shortMessage),
      standardMessage: String(parsed.standardMessage),
      warmMessage: String(parsed.warmMessage),
      safetyNotes: parsed.safetyNotes ? String(parsed.safetyNotes) : undefined,
    };
  }
}
