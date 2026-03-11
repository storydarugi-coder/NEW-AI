import { describe, it, expect } from "vitest";
import { treatmentDropoutRule } from "@/lib/engine/rules/treatment-dropout";
import { PatientWithVisits, RuleParams } from "@/lib/engine/types";

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
  nerve_treatment_days: 14,
  prosthetic_days: 21,
};

describe("치료 중단 탐지 규칙", () => {
  describe("신경치료 중단", () => {
    it("발수 후 14일 이상 경과, 근관충전 없음 → 탐지", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(20),
            procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }],
            diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(1);
      expect(results[0].subType).toBe("nerve_treatment");
      expect(results[0].ruleType).toBe("treatment_dropout");
      expect(results[0].reason).toContain("46번 치아");
    });

    it("발수 후 30일 이상 경과 → priority 1 (긴급)", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(35),
            procedures: [{ code: "U4411", name: "발수(전치)", tooth: "11" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results[0].priority).toBe(1);
    });

    it("발수 + 근관충전 완료 → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(20),
            procedures: [{ code: "U4411", name: "발수(전치)", tooth: "22" }],
            diagnoses: [],
          },
          {
            id: "v2",
            visitDate: daysAgo(10),
            procedures: [{ code: "U4414", name: "근관충전(전치)", tooth: "22" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(0);
    });

    it("발수 후 13일 (14일 미만) → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(13),
            procedures: [{ code: "U4412", name: "발수(구치)", tooth: "36" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(0);
    });

    it("치아별로 독립 판정 (A치아 중단 + B치아 완료)", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(25),
            procedures: [
              { code: "U4411", name: "발수(전치)", tooth: "11" },
              { code: "U4412", name: "발수(구치)", tooth: "36" },
            ],
            diagnoses: [],
          },
          {
            id: "v2",
            visitDate: daysAgo(15),
            procedures: [{ code: "U4414", name: "근관충전(전치)", tooth: "11" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(1);
      expect(results[0].reason).toContain("36번 치아");
    });
  });

  describe("보철 중단", () => {
    it("크라운 인상 후 21일 이상 경과 → 탐지", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(30),
            procedures: [{ code: "U6010", name: "크라운 인상", tooth: "26" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(1);
      expect(results[0].subType).toBe("prosthetic");
    });

    it("인상 + 세팅 완료 → 탐지 안 됨", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(14),
            procedures: [{ code: "U6010", name: "크라운 인상", tooth: "46" }],
            diagnoses: [],
          },
          {
            id: "v2",
            visitDate: daysAgo(3),
            procedures: [{ code: "U6030", name: "크라운 세팅", tooth: "46" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results.length).toBe(0);
    });

    it("45일 이상 경과 → priority 1 (긴급)", () => {
      const patient = makePatient({
        visits: [
          {
            id: "v1",
            visitDate: daysAgo(50),
            procedures: [{ code: "U6020", name: "보철 prep", tooth: "14" }],
            diagnoses: [],
          },
        ],
      });

      const results = treatmentDropoutRule.evaluate(patient, defaultParams);
      expect(results[0].priority).toBe(1);
    });
  });
});
