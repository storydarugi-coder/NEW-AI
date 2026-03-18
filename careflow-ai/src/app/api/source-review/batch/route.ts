import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

/**
 * 묶음 검토 API
 *
 * POST /api/source-review/batch — 같은 원문(sourceRaw) 기준 일괄 확정/반려/수정
 */

interface BatchRequest {
  action: "confirm" | "reject" | "modify";
  sourceRaw?: string;           // 같은 원문 기준
  visitIds?: string[];           // 또는 직접 지정
  reviewedSource?: string;       // modify 시 변경할 값
  reviewedCategory?: string;
  reviewedCtaFlag?: boolean;
  changeMemo?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const body = await request.json() as BatchRequest;
    const { action, sourceRaw, visitIds, reviewedSource, reviewedCategory, reviewedCtaFlag, changeMemo } = body;

    if (!action) {
      return NextResponse.json({ error: "action이 필요합니다." }, { status: 400 });
    }

    // tenant 스코핑
    const scope = getTenantScope(session);
    const tenantFilter = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};

    // 대상 Visit 조회
    let targetVisits;
    if (visitIds && visitIds.length > 0) {
      if (visitIds.length > 500) {
        return NextResponse.json({ error: "최대 500건까지 일괄 처리 가능합니다." }, { status: 400 });
      }
      targetVisits = await prisma.visit.findMany({
        where: { id: { in: visitIds }, ...tenantFilter },
        select: {
          id: true, sourceRaw: true,
          normalizedSource: true, sourceCategory: true, ctaCandidate: true,
          reviewedSource: true, reviewedCategory: true, reviewedCtaFlag: true,
          sourceReviewStatus: true,
        },
      });
    } else if (sourceRaw) {
      targetVisits = await prisma.visit.findMany({
        where: {
          sourceRaw,
          sourceReviewStatus: { in: ["unreviewed"] },
          ...tenantFilter,
        },
        select: {
          id: true, sourceRaw: true,
          normalizedSource: true, sourceCategory: true, ctaCandidate: true,
          reviewedSource: true, reviewedCategory: true, reviewedCtaFlag: true,
          sourceReviewStatus: true,
        },
      });
    } else {
      return NextResponse.json({ error: "sourceRaw 또는 visitIds가 필요합니다." }, { status: 400 });
    }

    if (targetVisits.length === 0) {
      return NextResponse.json({ error: "처리 대상이 없습니다." }, { status: 404 });
    }

    const batchKey = sourceRaw || `batch_${Date.now()}`;
    const now = new Date();
    const changedBy = session.name;

    // 이력 데이터 준비
    const historyRows: {
      id: string;
      visitId: string;
      batchKey: string;
      prevNormalizedSource: string | null;
      prevCategory: string | null;
      prevCtaCandidate: boolean | null;
      prevReviewStatus: string | null;
      newNormalizedSource: string | null;
      newCategory: string | null;
      newCtaCandidate: boolean | null;
      newReviewStatus: string;
      changeType: string;
      changedBy: string;
      changeMemo: string | null;
    }[] = [];

    // 업데이트 데이터
    const updateData: Record<string, unknown> = {
      sourceReviewedAt: now,
      sourceReviewedBy: changedBy,
    };

    let newReviewStatus: string;

    if (action === "confirm") {
      // 시스템 추천값 그대로 확정
      newReviewStatus = "manually_confirmed";
      updateData.sourceReviewStatus = newReviewStatus;
    } else if (action === "reject") {
      newReviewStatus = "rejected";
      updateData.sourceReviewStatus = newReviewStatus;
    } else if (action === "modify") {
      if (!reviewedSource) {
        return NextResponse.json({ error: "modify 시 reviewedSource가 필요합니다." }, { status: 400 });
      }
      newReviewStatus = "manually_confirmed";
      updateData.sourceReviewStatus = newReviewStatus;
      updateData.reviewedSource = reviewedSource;
      if (reviewedCategory !== undefined) updateData.reviewedCategory = reviewedCategory;
      if (typeof reviewedCtaFlag === "boolean") updateData.reviewedCtaFlag = reviewedCtaFlag;
    } else {
      return NextResponse.json({ error: "유효하지 않은 action입니다." }, { status: 400 });
    }

    // 개별 visit마다 처리 (이력 + 확정값 설정)
    for (const v of targetVisits) {
      const visitUpdateData = { ...updateData };

      if (action === "confirm") {
        // 각 visit의 시스템 추천값을 확정값으로 복사
        visitUpdateData.reviewedSource = v.normalizedSource;
        visitUpdateData.reviewedCategory = v.sourceCategory;
        visitUpdateData.reviewedCtaFlag = v.ctaCandidate;
      }

      await prisma.visit.update({
        where: { id: v.id },
        data: visitUpdateData,
      });

      historyRows.push({
        id: randomUUID(),
        visitId: v.id,
        batchKey,
        prevNormalizedSource: v.reviewedSource || v.normalizedSource,
        prevCategory: v.reviewedCategory || v.sourceCategory,
        prevCtaCandidate: v.reviewedCtaFlag ?? v.ctaCandidate,
        prevReviewStatus: v.sourceReviewStatus,
        newNormalizedSource: action === "modify" ? (reviewedSource || null) : v.normalizedSource,
        newCategory: action === "modify" ? (reviewedCategory || v.sourceCategory) : v.sourceCategory,
        newCtaCandidate: action === "modify" ? (reviewedCtaFlag ?? v.ctaCandidate) : v.ctaCandidate,
        newReviewStatus,
        changeType: action === "confirm" ? "batch_confirm" : action === "reject" ? "batch_reject" : "batch_modify",
        changedBy,
        changeMemo: changeMemo || null,
      });
    }

    // 이력 벌크 생성
    if (historyRows.length > 0) {
      await prisma.sourceNormalizationHistory.createMany({ data: historyRows });
    }

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: `batch_${action}`,
        entityType: "visit_batch",
        entityId: batchKey,
        detail: JSON.stringify({ action, count: targetVisits.length, sourceRaw: sourceRaw?.substring(0, 100), changeMemo }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${targetVisits.length}건이 일괄 ${action === "confirm" ? "확정" : action === "reject" ? "반려" : "수정"}되었습니다.`,
      count: targetVisits.length,
    });
  } catch (error) {
    console.error("Batch review error:", error);
    return NextResponse.json(
      { error: "묶음 검토 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
