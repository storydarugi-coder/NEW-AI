import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";
import { DashboardContent } from "@/components/dashboard/dashboard-content";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const ruleConfigs = await prisma.ruleConfig.findMany();
  const engineConfig = buildEngineConfig(ruleConfigs);

  const patients = await prisma.patient.findMany({
    include: {
      visits: {
        include: { procedures: true, diagnoses: true },
        orderBy: { visitDate: "desc" },
      },
    },
  });

  const detectionMap = evaluateAllPatients(patients, engineConfig);

  let treatmentDropoutCount = 0;
  let recallDueCount = 0;
  let messageSuggestionCount = 0;

  interface ScoreFactor {
    label: string;
    score: number;
    reason: string;
  }

  interface PriorityPatientItem {
    patientId: string;
    patientName: string;
    chartNumber: string;
    isVip: boolean;
    topPriority: number;
    priorityScore: number;
    scoreFactors: ScoreFactor[];
    lastVisitDate: string | null;
    detections: {
      ruleType: string;
      subType: string;
      priority: number;
      reason: string;
    }[];
  }

  const priorityPatients: PriorityPatientItem[] = [];

  for (const [patientId, detections] of detectionMap.entries()) {
    const patient = patients.find((p) => p.id === patientId);
    if (!patient) continue;

    for (const d of detections) {
      if (d.ruleType === "treatment_dropout") treatmentDropoutCount++;
      if (d.ruleType === "scaling_recall" || d.ruleType === "implant_followup")
        recallDueCount++;
      messageSuggestionCount++;
    }

    const lastVisitDate = patient.visits[0]?.visitDate || null;
    const { totalScore, factors } = calculatePriorityScore(
      detections,
      lastVisitDate,
      patient.isVip,
      patient.visits.length
    );

    priorityPatients.push({
      patientId,
      patientName: patient.name,
      chartNumber: patient.chartNumber,
      isVip: patient.isVip,
      topPriority: Math.min(...detections.map((d) => d.priority)),
      priorityScore: totalScore,
      scoreFactors: factors,
      lastVisitDate: lastVisitDate?.toISOString() || null,
      detections: detections.map((d) => ({
        ruleType: d.ruleType,
        subType: d.subType,
        priority: d.priority,
        reason: d.reason,
      })),
    });
  }

  // 점수 기반 정렬
  priorityPatients.sort((a, b) => b.priorityScore - a.priorityScore);

  // 전주 대비 변화 (mock)
  const weeklyChanges = {
    todayAction: calculateWeeklyChange(detectionMap.size),
    treatmentDropout: calculateWeeklyChange(treatmentDropoutCount),
    recallDue: calculateWeeklyChange(recallDueCount),
    messageSuggestion: calculateWeeklyChange(messageSuggestionCount),
  };

  // "오늘 바로 연락 권장" 환자 (긴급 + 높음)
  const urgentPatients = priorityPatients
    .filter((p) => p.topPriority <= 2)
    .slice(0, 5);

  return (
    <DashboardContent
      stats={{
        todayActionCount: detectionMap.size,
        treatmentDropoutCount,
        recallDueCount,
        messageSuggestionCount,
      }}
      weeklyChanges={weeklyChanges}
      urgentPatients={urgentPatients}
      priorityPatients={priorityPatients.slice(0, 20)}
    />
  );
}
