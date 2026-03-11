import { describe, it, expect } from "vitest";
import { TemplateFallbackProvider } from "@/lib/ai/template-fallback";
import { MessageGenerationInput } from "@/lib/ai/provider";

const provider = new TemplateFallbackProvider();

function makeInput(overrides: Partial<MessageGenerationInput> = {}): MessageGenerationInput {
  return {
    patientName: "김민수",
    recentVisitDate: "2024-12-01",
    recallReason: "신경치료 시작 후 30일 경과, 근관충전 미완료",
    recallSubType: "nerve_treatment",
    recommendedAction: "근관충전 재예약 권장",
    tone: "polite",
    purpose: "치료 완료 안내",
    ...overrides,
  };
}

describe("템플릿 fallback 메시지 생성기", () => {
  it("항상 사용 가능 (isAvailable = true)", async () => {
    expect(await provider.isAvailable()).toBe(true);
  });

  it("3가지 버전 메시지를 모두 생성", async () => {
    const result = await provider.generate(makeInput());
    expect(result.shortMessage).toBeTruthy();
    expect(result.standardMessage).toBeTruthy();
    expect(result.warmMessage).toBeTruthy();
    expect(result.generatedBy).toBe("template");
  });

  it("환자 이름이 메시지에 포함됨", async () => {
    const result = await provider.generate(makeInput({ patientName: "홍길동" }));
    expect(result.standardMessage).toContain("홍길동");
    expect(result.warmMessage).toContain("홍길동");
  });

  it("톤별로 다른 인사말 생성 — 정중함", async () => {
    const result = await provider.generate(makeInput({ tone: "polite" }));
    expect(result.standardMessage).toContain("안녕하세요, 김민수님.");
  });

  it("톤별로 다른 인사말 생성 — 친근함", async () => {
    const result = await provider.generate(makeInput({ tone: "friendly" }));
    expect(result.standardMessage).toContain("김민수님 안녕하세요~");
  });

  it("톤별로 다른 인사말 생성 — 원장 직접", async () => {
    const result = await provider.generate(makeInput({ tone: "doctor" }));
    expect(result.standardMessage).toContain("원장입니다");
  });

  it("짧은 메시지는 90자 이하", async () => {
    const result = await provider.generate(makeInput());
    expect(result.shortMessage.length).toBeLessThanOrEqual(90);
  });

  it("다양한 subType에 대해 메시지 생성 가능", async () => {
    const subTypes = [
      "nerve_treatment",
      "prosthetic",
      "scaling_insurance",
      "perio_recall",
      "implant_1m",
      "wisdom_tooth",
      "orthodontic",
    ];

    for (const subType of subTypes) {
      const result = await provider.generate(makeInput({ recallSubType: subType }));
      expect(result.shortMessage).toBeTruthy();
      expect(result.standardMessage).toBeTruthy();
      expect(result.warmMessage).toBeTruthy();
    }
  });

  it("알 수 없는 subType도 기본 메시지로 처리 (에러 없음)", async () => {
    const result = await provider.generate(makeInput({ recallSubType: "unknown_type" }));
    expect(result.shortMessage).toBeTruthy();
    expect(result.generatedBy).toBe("template");
  });
});
