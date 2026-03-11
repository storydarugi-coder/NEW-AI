import { DetectionResult, SubType } from "@/types";
import { PatientWithVisits, Rule, RuleParams } from "../types";
import { differenceInDays, addMonths } from "date-fns";

const IMPLANT_FIXTURE_CODES = ["U4451", "U4452", "U4453"]; // fixture 식립
const IMPLANT_PROSTH_CODES = ["U6050", "U6051", "U6052"]; // 임플란트 보철 완료
const IMPLANT_CHECKUP_CODES = ["U4460", "U4461"]; // 임플란트 점검

function hasAnyCode(codes: string[], targetCodes: string[]): boolean {
  return codes.some((c) => targetCodes.includes(c));
}

const CHECKUP_SCHEDULE: { months: number; subType: SubType; label: string }[] = [
  { months: 1, subType: "implant_1m", label: "1개월" },
  { months: 3, subType: "implant_3m", label: "3개월" },
  { months: 6, subType: "implant_6m", label: "6개월" },
  { months: 12, subType: "implant_12m", label: "12개월" },
];

export const implantFollowupRule: Rule = {
  type: "implant_followup",

  evaluate(patient: PatientWithVisits, params: RuleParams): DetectionResult[] {
    const results: DetectionResult[] = [];
    const now = new Date();
    const customMonths = params.implant_checkup_months as number[] | undefined;

    const sortedVisits = [...patient.visits].sort(
      (a, b) => new Date(a.visitDate).getTime() - new Date(b.visitDate).getTime()
    );

    // 임플란트 완료일 찾기 (보철 완료 또는 fixture 식립일)
    let implantCompletionDate: Date | null = null;
    let implantTooth: string | null = null;

    for (const visit of sortedVisits) {
      for (const proc of visit.procedures) {
        // 보철 완료가 있으면 그 날짜를 기준으로
        if (hasAnyCode([proc.code], IMPLANT_PROSTH_CODES)) {
          implantCompletionDate = new Date(visit.visitDate);
          implantTooth = proc.tooth;
        }
        // 보철 완료가 없으면 fixture 식립일 기준
        if (!implantCompletionDate && hasAnyCode([proc.code], IMPLANT_FIXTURE_CODES)) {
          implantCompletionDate = new Date(visit.visitDate);
          implantTooth = proc.tooth;
        }
      }
    }

    if (!implantCompletionDate) return results;

    // 점검 방문 이력 확인
    const checkupDates: Date[] = [];
    for (const visit of sortedVisits) {
      const visitDate = new Date(visit.visitDate);
      if (visitDate > implantCompletionDate) {
        const procs = visit.procedures.map((p) => p.code);
        if (hasAnyCode(procs, IMPLANT_CHECKUP_CODES)) {
          checkupDates.push(visitDate);
        }
      }
    }

    // 각 점검 시점 확인
    const schedule = customMonths
      ? customMonths.map((m) => {
          const s = CHECKUP_SCHEDULE.find((cs) => cs.months === m);
          return s || { months: m, subType: `implant_${m}m` as SubType, label: `${m}개월` };
        })
      : CHECKUP_SCHEDULE;

    for (const checkpoint of schedule) {
      const dueDate = addMonths(implantCompletionDate, checkpoint.months);
      const daysSinceDue = differenceInDays(now, dueDate);

      // 아직 도래하지 않은 점검은 7일 전부터 알림
      if (daysSinceDue < -7) continue;

      // 해당 시점 전후 14일 이내 점검 기록이 있는지 확인
      const hasCheckup = checkupDates.some(
        (d) => Math.abs(differenceInDays(d, dueDate)) <= 14
      );

      if (!hasCheckup) {
        const isOverdue = daysSinceDue > 0;
        results.push({
          patientId: patient.id,
          ruleType: "implant_followup",
          subType: checkpoint.subType,
          priority: isOverdue ? 2 : 3,
          reason: "임플란트 " + checkpoint.label + " 점검 " + (isOverdue ? daysSinceDue + "일 경과" : Math.abs(daysSinceDue) + "일 후 예정") + "." + (implantTooth ? " 치아 " + implantTooth : ""),
          evidenceDate: implantCompletionDate,
          evidenceDetail: `임플란트 완료일: ${implantCompletionDate.toISOString().split("T")[0]} | ${checkpoint.label} 점검 예정일: ${dueDate.toISOString().split("T")[0]} | 점검 기록: 없음`,
          dueDate,
        });
      }
    }

    return results;
  },
};
