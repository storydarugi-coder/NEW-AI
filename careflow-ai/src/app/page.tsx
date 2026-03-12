import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export const dynamic = "force-dynamic";

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

    const patients = await prisma.patient.findMany({
      include: {
        identity: true,
        visits: {
          include: { procedures: true, diagnoses: true },
          orderBy: { visitDate: "desc" },
        },
      },
    });

    if (patients.length === 0) {
      return <DbUnavailable reason="empty" />;
    }

    const detectionMap = evaluateAllPatients(patients, engineConfig);

    let treatmentDropoutCount = 0;
    let recallDueCount = 0;
    let messageSuggestionCount = 0;
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

    // 업무 처리 현황 요약
    const now = new Date();
    const wfTodayStart = new Date(now);
    wfTodayStart.setHours(0, 0, 0, 0);
    const wfTodayEnd = new Date(now);
    wfTodayEnd.setHours(23, 59, 59, 999);

    const workflowTasks = await prisma.workflowTask.findMany({
      where: { status: { notIn: ["completed", "excluded"] } },
      select: { status: true, nextFollowUpAt: true },
    });

    const workflowSummary = {
      totalActive: workflowTasks.length,
      unprocessed: workflowTasks.filter((t) => t.status === "unprocessed").length,
      todayFollowUps: workflowTasks.filter((t) =>
        t.nextFollowUpAt && t.nextFollowUpAt >= wfTodayStart && t.nextFollowUpAt <= wfTodayEnd
      ).length,
      overdueFollowUps: workflowTasks.filter((t) =>
        t.nextFollowUpAt && t.nextFollowUpAt < wfTodayStart
      ).length,
    };

    // CTA 요약 통계
    const ctaAttributions = await prisma.leadAttribution.findMany();
    const ctaStats = {
      totalLeads: ctaAttributions.length,
      pendingReview: ctaAttributions.filter((a) => a.reviewStatus === "pending").length,
      confirmed: ctaAttributions.filter((a) => a.reviewStatus === "confirmed").length,
      settlementEligible: ctaAttributions.filter((a) => a.settlementEligible).length,
    };

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
        ctaStats={ctaStats}
        workflowSummary={workflowSummary}
      />
    );
  } catch (error) {
    console.error("[CareFlow] Dashboard 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
