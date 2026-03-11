/**
 * 템플릿 기반 fallback 메시지 생성기
 *
 * Vertex AI가 비활성화되었거나 호출 실패 시 사용됩니다.
 * 규칙 기반으로 한국어 메시지를 생성합니다.
 */

import {
  AIProvider,
  MessageGenerationInput,
  GeneratedMessages,
} from "./provider";
import { templates } from "../message-generator/templates";

export class TemplateFallbackProvider implements AIProvider {
  name = "template";

  async isAvailable(): Promise<boolean> {
    return true; // 항상 사용 가능
  }

  async generate(input: MessageGenerationInput): Promise<GeneratedMessages> {
    const template = templates[input.recallSubType] || templates.default;
    const toneTemplate = template[input.tone] || template.polite;

    const greeting = this.getGreeting(input.tone, input.patientName);
    const closing = this.getClosing(input.tone);

    const shortMessage = `${greeting} ${this.shorten(toneTemplate, 60)}`;
    const standardMessage = `${greeting}\n${toneTemplate}\n${closing}`;
    const warmMessage = `${greeting}\n\n${toneTemplate}\n\n지난 방문(${input.recentVisitDate}) 이후 ${input.patientName}님의 건강이 궁금하여 연락드립니다.\n\n${closing}`;

    return {
      shortMessage: shortMessage.slice(0, 90),
      standardMessage,
      warmMessage,
      generatedBy: "template",
    };
  }

  private getGreeting(tone: string, name: string): string {
    switch (tone) {
      case "friendly":
        return `${name}님 안녕하세요~`;
      case "doctor":
        return `${name}님, 안녕하세요. 원장입니다.`;
      default:
        return `안녕하세요, ${name}님.`;
    }
  }

  private getClosing(tone: string): string {
    switch (tone) {
      case "friendly":
        return "편하실 때 연락 주세요! CareFlow 치과 드림";
      case "doctor":
        return "궁금하신 점은 언제든 문의 바랍니다. CareFlow 치과";
      default:
        return "CareFlow 치과에서 안내드렸습니다. 감사합니다.";
    }
  }

  private shorten(text: string, maxLen: number): string {
    if (text.length <= maxLen) return text;
    // 문장 단위로 자르기
    const sentences = text.split(/[.!?]/);
    let result = "";
    for (const s of sentences) {
      if ((result + s).length > maxLen) break;
      result += s + ".";
    }
    return result || text.slice(0, maxLen) + "...";
  }
}
