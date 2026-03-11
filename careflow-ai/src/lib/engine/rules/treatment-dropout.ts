import { DetectionResult } from "@/types";
import { PatientWithVisits, Rule, RuleParams } from "../types";
import { differenceInDays } from "date-fns";

// 치과 처치코드 매핑
const NERVE_START_CODES = ["U4411", "U4412", "U4413"]; // 근관치료 시작 (발수)
const NERVE_COMPLETE_CODES = ["U4414", "U4415", "U4416"]; // 근관충전/완결
const PROSTH_PREP_CODES = ["U6010", "U6011", "U6020"]; // 보철 인상/prep
const PROSTH_SETTING_CODES = ["U6030", "U6031", "U6040"]; // 보철 세팅

function hasCode(codes: string[], targetCodes: string[]): boolean {
  return codes.some((c) => targetCodes.includes(c));
}

export const treatmentDropoutRule: Rule = {
  type: "treatment_dropout",

  evaluate(patient: PatientWithVisits, params: RuleParams): DetectionResult[] {
    const results: DetectionResult[] = [];
    const now = new Date();
    const nerveDays = (params.nerve_treatment_days as number) || 14;
    const prosthDays = (params.prosthetic_days as number) || 21;

    // 모든 방문을 날짜순으로 정렬
    const sortedVisits = [...patient.visits].sort(
      (a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    );

    // A-1: 신경치료 중단 검사
    // 치아별로 그룹핑하여 검사
    const nerveStartsByTooth = new Map<string, Date>();
    const nerveCompletesByTooth = new Set<string>();

    for (const visit of sortedVisits) {
      for (const proc of visit.procedures) {
        const tooth = proc.tooth || "unknown";
        if (hasCode([proc.code], NERVE_START_CODES)) {
          if (!nerveStartsByTooth.has(tooth)) {
            nerveStartsByTooth.set(tooth, new Date(visit.visitDate));
          }
        }
        if (hasCode([proc.code], NERVE_COMPLETE_CODES)) {
          nerveCompletesByTooth.add(tooth);
        }
      }
    }

    for (const [tooth, startDate] of nerveStartsByTooth.entries()) {
      if (!nerveCompletesByTooth.has(tooth)) {
        const daysSince = differenceInDays(now, startDate);
        if (daysSince >= nerveDays) {
          results.push({
            patientId: patient.id,
            ruleType: "treatment_dropout",
            subType: "nerve_treatment",
            priority: daysSince > 30 ? 1 : 2,
            reason: `${tooth}번 치아 신경치료 시작 후 ${daysSince}일 경과, 근관충전 미완료`,
            evidenceDate: startDate,
            evidenceDetail: `치아 ${tooth} | 발수 시작일: ${startDate.toISOString().split("T")[0]} | 경과일: ${daysSince}일 | 기준: ${nerveDays}일 초과`,
          });
        }
      }
    }

    // A-2: 보철 중단 검사
    const prosthPrepsByTooth = new Map<string, Date>();
    const prosthSettingsByTooth = new Set<string>();

    for (const visit of sortedVisits) {
      for (const proc of visit.procedures) {
        const tooth = proc.tooth || "unknown";
        if (hasCode([proc.code], PROSTH_PREP_CODES)) {
          if (!prosthPrepsByTooth.has(tooth)) {
            prosthPrepsByTooth.set(tooth, new Date(visit.visitDate));
          }
        }
        if (hasCode([proc.code], PROSTH_SETTING_CODES)) {
          prosthSettingsByTooth.add(tooth);
        }
      }
    }

    for (const [tooth, prepDate] of prosthPrepsByTooth.entries()) {
      if (!prosthSettingsByTooth.has(tooth)) {
        const daysSince = differenceInDays(now, prepDate);
        if (daysSince >= prosthDays) {
          results.push({
            patientId: patient.id,
            ruleType: "treatment_dropout",
            subType: "prosthetic",
            priority: daysSince > 45 ? 1 : 2,
            reason: `${tooth}번 치아 보철 인상/prep 후 ${daysSince}일 경과, 세팅 미완료`,
            evidenceDate: prepDate,
            evidenceDetail: `치아 ${tooth} | 인상/prep일: ${prepDate.toISOString().split("T")[0]} | 경과일: ${daysSince}일 | 기준: ${prosthDays}일 초과`,
          });
        }
      }
    }

    return results;
  },
};
