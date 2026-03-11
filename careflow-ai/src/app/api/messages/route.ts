import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";
import { generateMessages } from "@/lib/ai/generate-message";
import { MessageTone } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, detectionIndex, tone } = body as {
      patientId: string;
      detectionIndex?: number;
      tone?: MessageTone;
    };

    if (!patientId) {
      return NextResponse.json(
        { error: "환자 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      include: {
        visits: {
          include: { procedures: true, diagnoses: true },
          orderBy: { visitDate: "desc" },
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

    if (detections.length === 0) {
      return NextResponse.json(
        { error: "이 환자에 대한 추천 사항이 없습니다." },
        { status: 400 }
      );
    }

    const detection = detections[detectionIndex || 0];
    const selectedTone = tone || "polite";
    const recentVisitDate = patient.visits[0]?.visitDate
      ? patient.visits[0].visitDate.toISOString().split("T")[0]
      : undefined;

    // 새 AI 메시지 생성기 사용 (3가지 버전)
    const messages = await generateMessages({
      patientName: patient.name,
      detection,
      tone: selectedTone,
      recentVisitDate,
    });

    // 3가지 버전을 DB에 저장
    const drafts = await Promise.all([
      prisma.messageDraft.create({
        data: {
          patientId: patient.id,
          tone: selectedTone,
          length: "short",
          content: messages.shortMessage,
          status: "draft",
        },
      }),
      prisma.messageDraft.create({
        data: {
          patientId: patient.id,
          tone: selectedTone,
          length: "medium",
          content: messages.standardMessage,
          status: "draft",
        },
      }),
      prisma.messageDraft.create({
        data: {
          patientId: patient.id,
          tone: selectedTone,
          length: "long",
          content: messages.warmMessage,
          status: "draft",
        },
      }),
    ]);

    return NextResponse.json({
      messages,
      drafts,
      generatedBy: messages.generatedBy,
    });
  } catch (error) {
    console.error("Message generation error:", error);
    return NextResponse.json(
      { error: "메시지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
