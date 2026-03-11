import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        visits: {
          include: {
            procedures: true,
            diagnoses: true,
          },
          orderBy: { visitDate: "desc" },
        },
        messageDrafts: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!patient) {
      return NextResponse.json(
        { error: "환자를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 규칙 엔진 실행
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);
    const detections = evaluatePatient(patient, engineConfig);

    return NextResponse.json({
      patient: {
        id: patient.id,
        chartNumber: patient.chartNumber,
        name: patient.name,
        gender: patient.gender,
        birthYear: patient.birthYear,
        phone: patient.phone,
        isVip: patient.isVip,
        memo: patient.memo,
        createdAt: patient.createdAt,
      },
      visits: patient.visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate,
        memo: v.memo,
        procedures: v.procedures,
        diagnoses: v.diagnoses,
      })),
      detections: detections.map((d) => ({
        ruleType: d.ruleType,
        subType: d.subType,
        priority: d.priority,
        reason: d.reason,
        evidenceDate: d.evidenceDate?.toISOString() || null,
        evidenceDetail: d.evidenceDetail,
        dueDate: d.dueDate?.toISOString() || null,
      })),
      messageDrafts: patient.messageDrafts,
    });
  } catch (error) {
    console.error("Patient detail API error:", error);
    return NextResponse.json(
      { error: "환자 정보를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
