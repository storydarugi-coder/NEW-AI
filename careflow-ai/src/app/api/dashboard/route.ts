import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";

export async function GET() {
  try {
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);

    const patients = await prisma.patient.findMany({
      include: {
        identity: true,
        visits: {
          include: {
            procedures: true,
            diagnoses: true,
          },
          orderBy: { visitDate: "desc" },
        },
      },
    });

    const detectionMap = evaluateAllPatients(patients, engineConfig);

    let treatmentDropoutCount = 0;
    let recallDueCount = 0;
    let messageSuggestionCount = 0;

    interface PriorityPatient {
      patientId: string;
      patientName: string;
      chartNumber: string;
      isVip: boolean;
      topPriority: number;
      detections: {
        ruleType: string;
        subType: string;
        priority: number;
        reason: string;
        evidenceDate: string | null;
      }[];
    }

    const priorityPatients: PriorityPatient[] = [];

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
        patientName: patient.identity?.name || patient.chartNumber,
        chartNumber: patient.chartNumber,
        isVip: patient.isVip,
        topPriority: Math.min(...detections.map((d) => d.priority)),
        detections: detections.map((d) => ({
          ruleType: d.ruleType,
          subType: d.subType,
          priority: d.priority,
          reason: d.reason,
          evidenceDate: d.evidenceDate?.toISOString() || null,
        })),
      });
    }

    priorityPatients.sort((a, b) => {
      if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
      return a.topPriority - b.topPriority;
    });

    return NextResponse.json({
      stats: {
        todayActionCount: detectionMap.size,
        treatmentDropoutCount,
        recallDueCount,
        messageSuggestionCount,
      },
      priorityPatients: priorityPatients.slice(0, 20),
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return NextResponse.json(
      { error: "데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
