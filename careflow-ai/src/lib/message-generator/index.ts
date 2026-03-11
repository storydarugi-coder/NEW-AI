import { MessageTone, MessageLength, DetectionResult, SUB_TYPE_LABELS } from "@/types";
import { templates } from "./templates";

export interface MessageGeneratorInput {
  patientName: string;
  detection: DetectionResult;
  tone: MessageTone;
  length: MessageLength;
  clinicName?: string;
}

export interface MessageGeneratorProvider {
  generate(input: MessageGeneratorInput): Promise<string>;
}

/**
 * 템플릿/룰 기반 메시지 생성기 (V1)
 * 추후 LLM API 연동 시 이 인터페이스를 구현하는 새 클래스로 교체 가능
 */
export class TemplateMessageGenerator implements MessageGeneratorProvider {
  async generate(input: MessageGeneratorInput): Promise<string> {
    const { patientName, detection, tone, length, clinicName = "CareFlow 치과" } = input;

    const subTypeLabel = SUB_TYPE_LABELS[detection.subType] || detection.subType;
    const template = templates[detection.subType] || templates.default;

    const greeting = this.getGreeting(tone, patientName);
    const body = template[tone] || template.polite;
    const closing = this.getClosing(tone, clinicName);

    // 길이에 따라 조합
    switch (length) {
      case "short":
        return `${greeting} ${body}`;
      case "long":
        return `${greeting}\n\n${body}\n\n${this.getDetail(detection, subTypeLabel)}\n\n${closing}`;
      case "medium":
      default:
        return `${greeting}\n${body}\n${closing}`;
    }
  }

  private getGreeting(tone: MessageTone, name: string): string {
    switch (tone) {
      case "friendly":
        return `${name}님 안녕하세요~ 😊`;
      case "doctor":
        return `${name}님, 안녕하세요. 원장입니다.`;
      case "polite":
      default:
        return `안녕하세요, ${name}님.`;
    }
  }

  private getClosing(tone: MessageTone, clinicName: string): string {
    switch (tone) {
      case "friendly":
        return `편하실 때 연락 주세요! ${clinicName} 드림 💙`;
      case "doctor":
        return `궁금하신 점은 언제든 문의 바랍니다. ${clinicName}`;
      case "polite":
      default:
        return `${clinicName}에서 안내드렸습니다. 감사합니다.`;
    }
  }

  private getDetail(detection: DetectionResult, label: string): string {
    return `[참고] ${label} 관련 안내입니다. ${detection.evidenceDetail || ""}`;
  }
}

// 기본 생성기 인스턴스
export const messageGenerator = new TemplateMessageGenerator();

/**
 * 추후 LLM 기반 생성기 (확장 포인트)
 * 아래와 같은 형태로 구현 가능:
 *
 * class LLMMessageGenerator implements MessageGeneratorProvider {
 *   constructor(private apiKey: string, private model: string) {}
 *   async generate(input: MessageGeneratorInput): Promise<string> {
 *     const prompt = buildPrompt(input);
 *     const response = await callLLM(prompt);
 *     return response;
 *   }
 * }
 */
