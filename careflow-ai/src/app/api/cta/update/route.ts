import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { evaluateSettlementEligibility } from "@/lib/cta/classify";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

/**
 * CTA 유입 귀속 정보 업데이트
 * PATCH /api/cta/update
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const body = await request.json();
    const { attributionId, ...updates } = body as {
      attributionId: string;
      treatmentStarted?: boolean;
      reviewMemo?: string;
      ineligibleReason?: string;
      settlementEligible?: boolean;
    };

    if (!attributionId) {
      return NextResponse.json(
        { error: "attributionId가 필요합니다." },
        { status: 400 }
      );
    }

    const current = await prisma.leadAttribution.findUnique({
      where: { id: attributionId },
      include: { visit: { include: { patient: { select: { tenantId: true } } } } },
    });

    if (!current) {
      return NextResponse.json(
        { error: "해당 귀속 정보를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // tenant 접근 검증
    const scope = getTenantScope(session);
    if (scope.tenantId && current.visit.patient.tenantId && current.visit.patient.tenantId !== scope.tenantId) {
      return NextResponse.json(
        { error: "접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 업데이트할 데이터 구성
    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (typeof updates.treatmentStarted === "boolean" && updates.treatmentStarted !== current.treatmentStarted) {
      data.treatmentStarted = updates.treatmentStarted;
      changes.treatmentStarted = { from: current.treatmentStarted, to: updates.treatmentStarted };
    }

    if (typeof updates.reviewMemo === "string") {
      data.reviewMemo = updates.reviewMemo;
      changes.reviewMemo = { from: current.reviewMemo, to: updates.reviewMemo };
    }

    // 진료 시작 여부 변경 시 정산 인정 여부 자동 재계산
    const newTreatmentStarted = updates.treatmentStarted ?? current.treatmentStarted;
    const newReviewStatus = current.reviewStatus;
    const newIsDuplicate = current.isDuplicate;

    if (typeof updates.settlementEligible === "boolean") {
      // 수동 정산 포함/제외 처리
      data.settlementEligible = updates.settlementEligible;
      data.ineligibleReason = updates.settlementEligible
        ? null
        : (updates.ineligibleReason || current.ineligibleReason || "수동 제외 처리");
      changes.settlementEligible = { from: current.settlementEligible, to: updates.settlementEligible };
    } else if (changes.treatmentStarted) {
      // 진료 시작 변경에 따른 자동 재계산
      const { eligible, reason } = evaluateSettlementEligibility({
        reviewStatus: newReviewStatus,
        treatmentStarted: newTreatmentStarted,
        isDuplicate: newIsDuplicate,
      });
      data.settlementEligible = eligible;
      data.ineligibleReason = eligible ? null : reason;
    }

    if (typeof updates.ineligibleReason === "string" && typeof updates.settlementEligible !== "boolean") {
      data.ineligibleReason = updates.ineligibleReason;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "변경할 내용이 없습니다." },
        { status: 400 }
      );
    }

    const attribution = await prisma.leadAttribution.update({
      where: { id: attributionId },
      data,
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "update_attribution",
        entityType: "attribution",
        entityId: attributionId,
        detail: JSON.stringify({ changes }),
      },
    });

    return NextResponse.json({ success: true, attribution });
  } catch (error) {
    console.error("CTA update error:", error);
    return NextResponse.json(
      { error: "업데이트 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
