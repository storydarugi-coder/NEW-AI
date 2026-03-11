import { DetectionResult } from "@/types";
import { PatientWithVisits, Rule, RuleParams } from "../types";
import { differenceInMonths, differenceInDays } from "date-fns";

const SCALING_CODES = ["U2230", "U2231", "U2232"]; // 치석제거(스케일링)
const PERIO_CODES = ["U1010", "U1020", "U1030", "U1040"]; // 치주소파술/치주치료

function hasAnyCode(codes: string[], targetCodes: string[]): boolean {
  return codes.some((c) => targetCodes.includes(c));
}

export const scalingRecallRule: Rule = {
  type: "scaling_recall",

  evaluate(patient: PatientWithVisits, params: RuleParams): DetectionResult[] {
    const results: DetectionResult[] = [];
    const now = new Date();
    const currentYear = now.getFullYear();
    const perioRecallMonths = (params.perio_recall_months as number) || 4;

    const sortedVisits = [...patient.visits].sort(
      (a, b) => new Date(b.visitDate).getTime() - new Date(a.visitDate).getTime()
    );

    // B-1: 보험 스케일링 안내
    // 작년에 스케일링 했으나 올해 기록이 없는 환자
    let lastScalingDate: Date | null = null;
    let hasCurrentYearScaling = false;

    for (const visit of sortedVisits) {
      const visitDate = new Date(visit.visitDate);
      const procs = visit.procedures.map((p) => p.code);

      if (hasAnyCode(procs, SCALING_CODES)) {
        if (visitDate.getFullYear() === currentYear) {
          hasCurrentYearScaling = true;
        }
        if (!lastScalingDate || visitDate > lastScalingDate) {
          lastScalingDate = visitDate;
        }
      }
    }

    if (lastScalingDate && !hasCurrentYearScaling) {
      const monthsSince = differenceInMonths(now, lastScalingDate);
      results.push({
        patientId: patient.id,
        ruleType: "scaling_recall",
        subType: "scaling_insurance",
        priority: monthsSince > 18 ? 2 : 3,
        reason: `마지막 스케일링: ${lastScalingDate.toISOString().split("T")[0]} (${monthsSince}개월 전). 올해 보험 스케일링 미수진`,
        evidenceDate: lastScalingDate,
        evidenceDetail: `마지막 스케일링일: ${lastScalingDate.toISOString().split("T")[0]} | ${currentYear}년 스케일링 기록 없음 | 보험 적용 가능`,
      });
    }

    // B-2: 치주 리콜
    // 치주치료 이력이 있는 환자의 정기 리콜
    let lastPerioDate: Date | null = null;
    let hasPerioHistory = false;

    for (const visit of sortedVisits) {
      const procs = visit.procedures.map((p) => p.code);
      if (hasAnyCode(procs, PERIO_CODES)) {
        hasPerioHistory = true;
        const visitDate = new Date(visit.visitDate);
        if (!lastPerioDate || visitDate > lastPerioDate) {
          lastPerioDate = visitDate;
        }
      }
    }

    if (hasPerioHistory && lastPerioDate) {
      // 최근 방문일 기준으로 체크
      const lastVisitDate = sortedVisits[0]
        ? new Date(sortedVisits[0].visitDate)
        : null;
      const referenceDate = lastVisitDate || lastPerioDate;
      const monthsSinceVisit = differenceInMonths(now, referenceDate);

      if (monthsSinceVisit >= perioRecallMonths) {
        const dueDate = new Date(referenceDate);
        dueDate.setMonth(dueDate.getMonth() + perioRecallMonths);

        const isOverdue = differenceInDays(now, dueDate) > 0;

        results.push({
          patientId: patient.id,
          ruleType: "scaling_recall",
          subType: "perio_recall",
          priority: isOverdue ? 2 : 3,
          reason: `치주치료 이력 환자. 마지막 방문 ${monthsSinceVisit}개월 전. ${perioRecallMonths}개월 주기 리콜 대상`,
          evidenceDate: referenceDate,
          evidenceDetail: `치주치료 이력 있음 | 최근 방문: ${referenceDate.toISOString().split("T")[0]} | 경과: ${monthsSinceVisit}개월 | 리콜 주기: ${perioRecallMonths}개월`,
          dueDate,
        });
      }
    }

    return results;
  },
};
