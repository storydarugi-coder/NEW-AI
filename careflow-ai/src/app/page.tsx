import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
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

  interface PriorityPatientItem {
    patientId: string;
    patientName: string;
    chartNumber: string;
    isVip: boolean;
    topPriority: number;
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

    priorityPatients.push({
      patientId,
      patientName: patient.name,
      chartNumber: patient.chartNumber,
      isVip: patient.isVip,
      topPriority: Math.min(...detections.map((d) => d.priority)),
      lastVisitDate: patient.visits[0]?.visitDate.toISOString() || null,
      detections: detections.map((d) => ({
        ruleType: d.ruleType,
        subType: d.subType,
        priority: d.priority,
        reason: d.reason,
      })),
    });
  }

  priorityPatients.sort((a, b) => {
    if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
    return a.topPriority - b.topPriority;
  });

  return (
    <DashboardContent
      stats={{
        todayActionCount: detectionMap.size,
        treatmentDropoutCount,
        recallDueCount,
        messageSuggestionCount,
      }}
      priorityPatients={priorityPatients.slice(0, 20)}
    />
  );
}
