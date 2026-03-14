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

    const response = await fetch(endpoint, {
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
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Gemini API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Gemini API 응답에서 텍스트 추출
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("AI 응답에서 텍스트를 추출할 수 없습니다.");
    }

    // JSON 파싱
    const parsed = this.parseResponse(text);

    return {
      ...parsed,
      generatedBy: "gemini",
    };
  }

  private parseResponse(text: string): Omit<GeneratedMessages, "generatedBy"> {
    try {
      // JSON 블록 추출 (```json ... ``` 형식도 처리)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("JSON 형식을 찾을 수 없습니다.");
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (!parsed.shortMessage || !parsed.standardMessage || !parsed.warmMessage) {
        throw new Error("필수 필드가 누락되었습니다.");
      }

      return {
        shortMessage: String(parsed.shortMessage),
        standardMessage: String(parsed.standardMessage),
        warmMessage: String(parsed.warmMessage),
        safetyNotes: parsed.safetyNotes ? String(parsed.safetyNotes) : undefined,
      };
    } catch {
      throw new Error("AI 응답 파싱 실패: " + text.slice(0, 100));
    }
  }
}
