import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateSettlementEligibility } from "@/lib/cta/classify";
import { requireSession, requireProductArea } from "@/lib/api-auth";

export async function POST(request: NextRequest) {
  try {
    const { session: sessionUser, error: authError } = await requireSession();
    if (authError) return authError;
    const areaError = requireProductArea(sessionUser, "internal");
    if (areaError) return areaError;

    const body = await request.json();
    const { attributionId, reviewStatus, reviewer, memo } = body as {
      attributionId: string;
      reviewStatus: "confirmed" | "rejected";
      reviewer?: string;
      memo?: string;
    };

    if (!attributionId || !reviewStatus) {
      return NextResponse.json(
        { error: "attributionId와 reviewStatus가 필요합니다." },
        { status: 400 }
      );
    }

    if (!["confirmed", "rejected"].includes(reviewStatus)) {
      return NextResponse.json(
        { error: "reviewStatus는 confirmed 또는 rejected여야 합니다." },
        { status: 400 }
      );
    }

    // 현재 귀속 정보 조회
    const current = await prisma.leadAttribution.findUnique({
      where: { id: attributionId },
    });

    if (!current) {
      return NextResponse.json(
        { error: "해당 귀속 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 정산 인정 여부 재계산
    const { eligible, reason } = evaluateSettlementEligibility({
      reviewStatus,
      treatmentStarted: current.treatmentStarted,
      isDuplicate: current.isDuplicate,
    });

    const attribution = await prisma.leadAttribution.update({
      where: { id: attributionId },
      data: {
        reviewStatus,
        reviewer: reviewer || sessionUser?.name || "운영자",
        reviewedAt: new Date(),
        reviewMemo: memo || null,
        settlementEligible: eligible,
        ineligibleReason: eligible ? null : reason,
      },
    });

    // 감사 로그 (PII 미포함)
    await prisma.auditLog.create({
      data: {
        action: "review_attribution",
        entityType: "attribution",
        entityId: attributionId,
        detail: JSON.stringify({
          reviewStatus,
          reviewer: reviewer || sessionUser?.name || "운영자",
          settlementEligible: eligible,
        }),
      },
    });

    return NextResponse.json({ success: true, attribution });
  } catch (error) {
    console.error("CTA review error:", error);
    return NextResponse.json(
      { error: "검토 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
