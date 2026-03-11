import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";
import { messageGenerator } from "@/lib/message-generator";
import { MessageTone, MessageLength } from "@/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { patientId, detectionIndex, tone, length } = body as {
      patientId: string;
      detectionIndex?: number;
      tone?: MessageTone;
      length?: MessageLength;
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
          include: {
            procedures: true,
            diagnoses: true,
          },
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

    // 규칙 엔진 실행
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
    const selectedLength = length || "medium";

    // 메시지 생성
    const content = await messageGenerator.generate({
      patientName: patient.name,
      detection,
      tone: selectedTone,
      length: selectedLength,
    });

    // DB에 저장
    const messageDraft = await prisma.messageDraft.create({
      data: {
        patientId: patient.id,
        tone: selectedTone,
        length: selectedLength,
        content,
        status: "draft",
      },
    });

    return NextResponse.json({ messageDraft });
  } catch (error) {
    console.error("Message generation error:", error);
    return NextResponse.json(
      { error: "메시지 생성 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
