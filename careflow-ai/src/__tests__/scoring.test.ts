import { describe, it, expect } from "vitest";
import { calculatePriorityScore } from "@/lib/engine/scoring";
import { DetectionResult } from "@/types";

function makeDetection(overrides: Partial<DetectionResult> = {}): DetectionResult {
  return {
    patientId: "p1",
    ruleType: "treatment_dropout",
    subType: "nerve_treatment",
    priority: 2,
    reason: "테스트 사유",
    evidenceDate: new Date(),
    evidenceDetail: "테스트 상세",
    ...overrides,
  };
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

describe("우선순위 점수 산정", () => {
  it("탐지 건수가 많으면 심각도 점수 높음", () => {
    const detections = [
      makeDetection({ priority: 1 }),
      makeDetection({ priority: 2, subType: "prosthetic" }),
    ];
    const score = calculatePriorityScore(detections, daysAgo(30), false, 3);
    const severityFactor = score.factors.find((f) => f.label === "탐지 심각도");
    expect(severityFactor).toBeDefined();
    expect(severityFactor!.score).toBeGreaterThanOrEqual(20);
  });

  it("미방문 기간이 길면 점수 높음", () => {
    const detections = [makeDetection()];
    const score = calculatePriorityScore(detections, daysAgo(200), false, 1);
    const visitFactor = score.factors.find((f) => f.label === "미방문 기간");
    expect(visitFactor).toBeDefined();
    expect(visitFactor!.score).toBe(25);
  });

  it("치료 중단 탐지 시 가중 점수 부여", () => {
    const detections = [makeDetection({ ruleType: "treatment_dropout" })];
    const score = calculatePriorityScore(detections, daysAgo(30), false, 1);
    const dropoutFactor = score.factors.find((f) => f.label === "치료 중단 위험");
    expect(dropoutFactor).toBeDefined();
    expect(dropoutFactor!.score).toBe(20);
  });

  it("VIP 환자는 10점 가중", () => {
    const detections = [makeDetection()];
    const score = calculatePriorityScore(detections, daysAgo(30), true, 1);
    const vipFactor = score.factors.find((f) => f.label === "VIP 환자");
    expect(vipFactor).toBeDefined();
    expect(vipFactor!.score).toBe(10);
  });

  it("5회 이상 방문 환자 단골 가중", () => {
    const detections = [makeDetection()];
    const score = calculatePriorityScore(detections, daysAgo(30), false, 7);
    const loyaltyFactor = score.factors.find((f) => f.label === "단골 환자");
    expect(loyaltyFactor).toBeDefined();
    expect(loyaltyFactor!.score).toBe(5);
  });

  it("totalScore는 모든 factor의 합계", () => {
    const detections = [makeDetection({ ruleType: "treatment_dropout", priority: 1 })];
    const score = calculatePriorityScore(detections, daysAgo(100), true, 6);
    const expectedSum = score.factors.reduce((sum, f) => sum + f.score, 0);
    expect(score.totalScore).toBe(expectedSum);
  });

  it("복합 케이스: VIP + 치료중단 + 장기미방문 → 높은 점수", () => {
    const detections = [
      makeDetection({ ruleType: "treatment_dropout", priority: 1 }),
      makeDetection({ ruleType: "scaling_recall", subType: "scaling_insurance", priority: 3 }),
    ];
    const score = calculatePriorityScore(detections, daysAgo(200), true, 8);
    expect(score.totalScore).toBeGreaterThanOrEqual(70);
  });
});
