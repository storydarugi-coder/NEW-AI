import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";
import { requireSession, requireProductArea } from "@/lib/api-auth";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;

    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        identity: true,
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

    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);
    const detections = evaluatePatient(patient, engineConfig);

    return NextResponse.json({
      patient: {
        id: patient.id,
        chartNumber: patient.chartNumber,
        name: patient.identity?.name || patient.chartNumber,
        gender: patient.gender,
        birthYear: patient.birthYear,
        phone: patient.identity?.phone || "",
        isVip: patient.isVip,
        tags: patient.tags,
        createdAt: patient.createdAt,
      },
      visits: patient.visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate,
        memo: v.memo,
        channel: v.channel,
        isCta: v.isCta,
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
