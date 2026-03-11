/**
 * Vertex AI (Google Gemini) 프로바이더
 *
 * 서버 전용 모듈 — 클라이언트에서 직접 호출하지 않습니다.
 * GOOGLE_APPLICATION_CREDENTIALS 또는 서비스 계정 인증이 필요합니다.
 */

import {
  AIProvider,
  MessageGenerationInput,
  GeneratedMessages,
  AIProviderConfig,
} from "./provider";
import { buildMessagePrompt } from "./prompts";

export class VertexAIProvider implements AIProvider {
  name = "vertex";

  private config: AIProviderConfig;
  private projectId: string;
  private location: string;

  constructor(config: AIProviderConfig) {
    this.config = config;
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT || "";
    this.location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.enabled) return false;
    if (!this.projectId) return false;
    // 기본적인 환경 변수 확인만 수행
    return true;
  }

  async generate(input: MessageGenerationInput): Promise<GeneratedMessages> {
    const prompt = buildMessagePrompt(input);

    const endpoint = `https://${this.location}-aiplatform.googleapis.com/v1/projects/${this.projectId}/locations/${this.location}/publishers/google/models/${this.config.modelName}:generateContent`;

    // Google Cloud 인증 토큰 획득
    const accessToken = await this.getAccessToken();

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
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
      throw new Error(`Vertex AI API error (${response.status}): ${errorText.slice(0, 200)}`);
    }

    const data = await response.json();

    // Vertex AI 응답에서 텍스트 추출
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) {
      throw new Error("Vertex AI response에서 텍스트를 추출할 수 없습니다.");
    }

    // JSON 파싱
    const parsed = this.parseResponse(text);

    return {
      ...parsed,
      generatedBy: "vertex",
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
      throw new Error("Vertex AI 응답 파싱 실패: " + text.slice(0, 100));
    }
  }

  private async getAccessToken(): Promise<string> {
    // 방법 1: 환경 변수에서 직접 토큰 사용 (테스트용)
    if (process.env.GOOGLE_ACCESS_TOKEN) {
      return process.env.GOOGLE_ACCESS_TOKEN;
    }

    // 방법 2: gcloud CLI를 통한 토큰 획득 (로컬 개발)
    // 실제 프로덕션에서는 서비스 계정 또는 Workload Identity를 사용
    try {
      const { execSync } = await import("child_process");
      const token = execSync("gcloud auth print-access-token", {
        encoding: "utf-8",
        timeout: 5000,
      }).trim();
      return token;
    } catch {
      throw new Error(
        "Google Cloud 인증 토큰을 획득할 수 없습니다. " +
        "GOOGLE_ACCESS_TOKEN 환경변수를 설정하거나 gcloud CLI로 인증하세요."
      );
    }
  }
}
