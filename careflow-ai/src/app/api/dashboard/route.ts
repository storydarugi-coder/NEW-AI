import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { requireSession, requireProductArea } from "@/lib/api-auth";

export async function GET() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;
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

    // O(1) 조회를 위한 Map
    const patientMap = new Map(patients.map((p) => [p.id, p]));

    let treatmentDropoutCount = 0;
    let recallDueCount = 0;
    let messageSuggestionCount = 0;

    interface PriorityPatient {
      patientId: string;
      patientName: string;
      chartNumber: string;
      isVip: boolean;
      topPriority: number;
      priorityScore: number;
      lastVisitDate: string | null;
      daysSinceLastVisit: number | null;
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
      const patient = patientMap.get(patientId);
      if (!patient) continue;

      for (const d of detections) {
        if (d.ruleType === "treatment_dropout") treatmentDropoutCount++;
        if (d.ruleType === "scaling_recall" || d.ruleType === "implant_followup")
          recallDueCount++;
        messageSuggestionCount++;
      }

      // 최근 방문일 계산 (visits는 desc 정렬)
      const lastVisit = patient.visits[0];
      const lastVisitDate = lastVisit?.visitDate || null;
      const daysSinceLastVisit = lastVisitDate
        ? Math.floor((Date.now() - new Date(lastVisitDate).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      // 우선순위 점수 계산: 탐지 건수 × 긴급도 + 미내원 기간 보정 + VIP 가산
      const topPriority = Math.min(...detections.map((d) => d.priority));
      const urgencyBase = detections.reduce((sum, d) => sum + (5 - d.priority) * 10, 0);
      const absencePenalty = daysSinceLastVisit ? Math.min(Math.floor(daysSinceLastVisit / 7) * 5, 30) : 0;
      const vipBonus = patient.isVip ? 15 : 0;
      const priorityScore = Math.min(urgencyBase + absencePenalty + vipBonus, 100);

      priorityPatients.push({
        patientId,
        patientName: patient.identity?.name || patient.chartNumber,
        chartNumber: patient.chartNumber,
        isVip: patient.isVip,
        topPriority,
        priorityScore,
        lastVisitDate: lastVisitDate?.toISOString() || null,
        daysSinceLastVisit,
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
      return b.priorityScore - a.priorityScore;
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
