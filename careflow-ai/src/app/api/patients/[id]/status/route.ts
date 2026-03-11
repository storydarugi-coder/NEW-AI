import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: patientId } = await params;
    const body = await request.json();
    const { ruleType, subType, status } = body as {
      ruleType: string;
      subType: string;
      status: string; // contacted, completed, dismissed, pending
    };

    // 기존 추천이 있으면 업데이트, 없으면 생성
    const existing = await prisma.recallRecommendation.findFirst({
      where: { patientId, ruleType, subType },
    });

    if (existing) {
      await prisma.recallRecommendation.update({
        where: { id: existing.id },
        data: { status },
      });
    } else {
      await prisma.recallRecommendation.create({
        data: {
          patientId,
          ruleType,
          subType,
          status,
          reason: "",
          priority: 3,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Status update error:", error);
    return NextResponse.json(
      { error: "상태 변경 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
