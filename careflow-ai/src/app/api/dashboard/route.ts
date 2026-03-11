import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";

export async function GET() {
  try {
    // 규칙 설정 로드
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);

    // 모든 환자와 방문 이력 로드
    const patients = await prisma.patient.findMany({
      include: {
        visits: {
          include: {
            procedures: true,
            diagnoses: true,
          },
          orderBy: { visitDate: "desc" },
        },
      },
    });

    // 규칙 엔진 실행
    const detectionMap = evaluateAllPatients(patients, engineConfig);

    // 통계 계산
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
        patientName: patient.name,
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

    // 우선순위순 정렬 (VIP 우선)
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
