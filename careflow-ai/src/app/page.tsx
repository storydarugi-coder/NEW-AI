import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

// 60초 ISR — force-dynamic 제거로 첫 응답 캐시 활용
export const revalidate = 60;

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

export default async function DashboardPage() {
  try {
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);

    // 규칙 엔진에 필요한 최소 필드만 select
    const patients = await prisma.patient.findMany({
      select: {
        id: true,
        chartNumber: true,
        isVip: true,
        identity: { select: { name: true } },
        visits: {
          select: {
            id: true,
            visitDate: true,
            procedures: { select: { code: true, name: true, tooth: true } },
            diagnoses: { select: { code: true, name: true, tooth: true } },
          },
          orderBy: { visitDate: "desc" },
        },
      },
    });

    if (patients.length === 0) {
      return <DbUnavailable reason="empty" />;
    }

    // O(1) 조회를 위한 Map 구성
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    const detectionMap = evaluateAllPatients(patients, engineConfig);

    let treatmentDropoutCount = 0;
    let recallDueCount = 0;
    let messageSuggestionCount = 0;
    const priorityPatients: PriorityPatientItem[] = [];

    for (const [patientId, detections] of detectionMap.entries()) {
      const patient = patientMap.get(patientId); // O(1) — 기존 O(n) find 제거
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
        patientName: patient.identity?.name || patient.chartNumber,
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

    priorityPatients.sort((a, b) => b.priorityScore - a.priorityScore);

    const weeklyChanges = {
      todayAction: calculateWeeklyChange(detectionMap.size),
      treatmentDropout: calculateWeeklyChange(treatmentDropoutCount),
      recallDue: calculateWeeklyChange(recallDueCount),
      messageSuggestion: calculateWeeklyChange(messageSuggestionCount),
    };

    const urgentPatients = priorityPatients
      .filter((p) => p.topPriority <= 2)
      .slice(0, 5);

    // 부가 통계(CTA, workflow, source, sync, message)는
    // DashboardContent 클라이언트에서 /api/dashboard/secondary-stats 로 lazy fetch
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
  } catch (error) {
    console.error("[CareFlow] Dashboard 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
