import { DetectionResult } from "@/types";
import { PatientWithVisits, Rule, RuleParams } from "../types";

// 사랑니/매복지치 관련 코드
const WISDOM_CONSULT_DIAG = ["K010", "K011", "K018"]; // 매복치, 매복지치 진단
const WISDOM_EXTRACT_CODES = ["U4431", "U4432", "U4433", "U4434"]; // 발치(매복치 등)

// 교정 관련 코드
const ORTHO_CONSULT_CODES = ["ZZ001", "ZZ002"]; // 교정 상담/검사
const ORTHO_START_CODES = ["U7010", "U7011", "U7020"]; // 교정 장치 장착/시작

function hasAnyCode(codes: string[], targetCodes: string[]): boolean {
  return codes.some((c) => targetCodes.includes(c));
}

export const potentialDemandRule: Rule = {
  type: "potential_demand",

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  evaluate(patient: PatientWithVisits, _params: RuleParams): DetectionResult[] {
    const results: DetectionResult[] = [];

    const allProcCodes: string[] = [];
    const allDiagCodes: string[] = [];
    let wisdomConsultDate: Date | null = null;
    let orthoConsultDate: Date | null = null;

    const sortedVisits = [...patient.visits].sort(
      (a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    );

    for (const visit of sortedVisits) {
      const visitDate = new Date(visit.visitDate);
      for (const proc of visit.procedures) {
        allProcCodes.push(proc.code);
      }
      for (const diag of visit.diagnoses) {
        allDiagCodes.push(diag.code);
        if (hasAnyCode([diag.code], WISDOM_CONSULT_DIAG) && !wisdomConsultDate) {
          wisdomConsultDate = visitDate;
        }
      }
      for (const proc of visit.procedures) {
        if (hasAnyCode([proc.code], ORTHO_CONSULT_CODES) && !orthoConsultDate) {
          orthoConsultDate = visitDate;
        }
      }
    }

    // D-1: 사랑니 잠재 수요
    const hasWisdomDiagnosis = hasAnyCode(allDiagCodes, WISDOM_CONSULT_DIAG);
    const hasWisdomExtraction = hasAnyCode(allProcCodes, WISDOM_EXTRACT_CODES);

    if (hasWisdomDiagnosis && !hasWisdomExtraction && wisdomConsultDate) {
      results.push({
        patientId: patient.id,
        ruleType: "potential_demand",
        subType: "wisdom_tooth",
        priority: 4,
        reason: `매복지치/사랑니 진단 이력 있으나 발치 기록 없음`,
        evidenceDate: wisdomConsultDate,
        evidenceDetail: `사랑니 상담/진단일: ${wisdomConsultDate.toISOString().split("T")[0]} | 발치 기록: 없음 | 잠재 수요`,
      });
    }

    // D-2: 교정 잠재 수요
    const hasOrthoConsult = hasAnyCode(allProcCodes, ORTHO_CONSULT_CODES);
    const hasOrthoStart = hasAnyCode(allProcCodes, ORTHO_START_CODES);

    if (hasOrthoConsult && !hasOrthoStart && orthoConsultDate) {
      results.push({
        patientId: patient.id,
        ruleType: "potential_demand",
        subType: "orthodontic",
        priority: 4,
        reason: `교정 상담 이력 있으나 교정 시작 기록 없음`,
        evidenceDate: orthoConsultDate,
        evidenceDetail: `교정 상담일: ${orthoConsultDate.toISOString().split("T")[0]} | 교정 시작 기록: 없음 | 잠재 수요`,
      });
    }

    return results;
  },
};
