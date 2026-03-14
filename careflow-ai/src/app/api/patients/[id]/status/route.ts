import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireProductArea, guardTenantAccess } from "@/lib/api-auth";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;

    const { id: patientId } = await params;

    // 환자 테넌트 접근 검증
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { tenantId: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }
    const tenantError = guardTenantAccess(session, patient);
    if (tenantError) return tenantError;

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
