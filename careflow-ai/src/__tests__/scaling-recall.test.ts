import { describe, it, expect } from "vitest";
import { scalingRecallRule } from "@/lib/engine/rules/scaling-recall";
import { PatientWithVisits, RuleParams } from "@/lib/engine/types";

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(10, 0, 0, 0);
  return d;
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

function makePatient(overrides: Partial<PatientWithVisits> = {}): PatientWithVisits {
  return {
    id: "test-patient-1",
    name: "테스트환자",
    visits: [],
    ...overrides,
  };
}

const defaultParams: RuleParams = {
  scaling_months: 12,
  perio_recall_months: 4,
};

describe("스케일링/치주 리콜 규칙", () => {
  describe("보험 스케일링 리콜", () => {
    it("작년 스케일링 O, 올해 미수진 → 탐지", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: monthsAgo(14),
            procedures: [{ code: "U2230", name: "치석제거(1/3악)", tooth: null }],
            diagnoses: [],
          },
        ],
      });

      const results = scalingRecallRule.evaluate(patient, defaultParams);
      const scalingResult = results.find((r) => r.subType === "scaling_insurance");
      expect(scalingResult).toBeDefined();
      expect(scalingResult!.reason).toContain("보험 스케일링 미수진");
    });

    it("올해 스케일링 완료 → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(30),
            procedures: [{ code: "U2230", name: "치석제거(1/3악)", tooth: null }],
            diagnoses: [],
          },
        ],
      });

      const results = scalingRecallRule.evaluate(patient, defaultParams);
      const scalingResult = results.find((r) => r.subType === "scaling_insurance");
      expect(scalingResult).toBeUndefined();
    });

    it("스케일링 이력 없음 → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: monthsAgo(3),
            procedures: [{ code: "U0001", name: "검진", tooth: null }],
            diagnoses: [],
          },
        ],
      });

      const results = scalingRecallRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(0);
    });
  });

  describe("치주 리콜", () => {
    it("치주치료 이력 + 4개월 이상 미방문 → 탐지", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: monthsAgo(5),
            procedures: [{ code: "U1010", name: "치주소파술", tooth: null }],
            diagnoses: [{ code: "K053", name: "만성치주염", tooth: null }],
          },
        ],
      });

      const results = scalingRecallRule.evaluate(patient, defaultParams);
      const perioResult = results.find((r) => r.subType === "perio_recall");
      expect(perioResult).toBeDefined();
      expect(perioResult!.reason).toContain("치주치료 이력 환자");
    });

    it("치주치료 이력 + 최근 방문 (4개월 미만) → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: monthsAgo(6),
            procedures: [{ code: "U1010", name: "치주소파술", tooth: null }],
            diagnoses: [],
          },
          {
            id: "v2",
            visitDate: monthsAgo(2),
            procedures: [{ code: "U0001", name: "검진", tooth: null }],
            diagnoses: [],
          },
        ],
      });

      const results = scalingRecallRule.evaluate(patient, defaultParams);
      const perioResult = results.find((r) => r.subType === "perio_recall");
      expect(perioResult).toBeUndefined();
    });
  });
});
