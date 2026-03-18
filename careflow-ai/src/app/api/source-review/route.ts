import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizeSource, dbRuleToDefinition } from "@/lib/attribution/normalizer";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";
import { maskSourceRaw, maskName } from "@/lib/privacy";

/**
 * 방문경로 검토 API
 *
 * GET  /api/source-review — 검토 대상 방문 목록 조회
 * POST /api/source-review — 일괄 정규화 실행
 * PATCH /api/source-review — 개별 방문 경로 검토 확정/수정
 */

export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const { searchParams } = new URL(request.url);
    const reviewStatus = searchParams.get("status"); // unreviewed, auto_confirmed, manually_confirmed, all
    const confidence = searchParams.get("confidence"); // HIGH, MEDIUM, LOW
    const groupBy = searchParams.get("groupBy"); // raw, normalized
    const limit = parseInt(searchParams.get("limit") || "100");

    // DB 규칙 로드
    const dbRules = await prisma.sourceRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });
    const rules = dbRules.length > 0 ? dbRules.map(dbRuleToDefinition) : undefined;

    // 방문 기록 조회 (sourceRaw가 있는 것만 + tenant 스코핑)
    const scope = getTenantScope(session);
    const where: Record<string, unknown> = {
      sourceRaw: { not: null },
    };
    // tenant 스코핑: Visit에 tenantId가 없으므로 patient.tenantId로 필터링
    if (scope.tenantId) {
      where.patient = { tenantId: scope.tenantId };
    }
    if (reviewStatus && reviewStatus !== "all") {
      where.sourceReviewStatus = reviewStatus;
    }
    if (confidence) {
      where.matchConfidence = confidence;
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: { include: { identity: true } },
        matchedRule: true,
      },
      orderBy: { visitDate: "desc" },
      take: limit,
    });

    // 정규화 추천값을 실시간으로 계산 (아직 추천이 없는 경우)
    const items = visits.map((v) => {
      const needsNormalization = !v.normalizedSource;
      const recommendation = needsNormalization
        ? normalizeSource(v.sourceRaw, rules)
        : null;

      return {
        visitId: v.id,
        patientId: v.patientId,
        patientName: maskName(v.patient.identity?.name || v.patient.chartNumber),
        chartNumber: v.patient.chartNumber,
        visitDate: v.visitDate.toISOString(),
        sourceRaw: maskSourceRaw(v.sourceRaw),
        channel: v.channel,
        isCta: v.isCta,
        // 시스템 추천
        normalizedSource: v.normalizedSource || recommendation?.normalizedSource || null,
        sourceCategory: v.sourceCategory || recommendation?.sourceCategory || null,
        ctaCandidate: v.ctaCandidate ?? recommendation?.ctaCandidate ?? null,
        matchConfidence: v.matchConfidence || recommendation?.matchConfidence || null,
        matchReason: v.matchReason || recommendation?.matchReason || null,
        matchedRuleName: v.matchedRule?.ruleName || recommendation?.matchedRuleName || null,
        // 사람 확정값
        reviewedSource: v.reviewedSource,
        reviewedCategory: v.reviewedCategory,
        reviewedCtaFlag: v.reviewedCtaFlag,
        sourceReviewStatus: v.sourceReviewStatus,
        sourceReviewedBy: v.sourceReviewedBy,
        sourceReviewedAt: v.sourceReviewedAt?.toISOString() || null,
        sourceReviewMemo: v.sourceReviewMemo,
        // 최종 표시용 (확정값 우선)
        finalSource: v.reviewedSource || v.normalizedSource || recommendation?.normalizedSource || "Unknown",
        finalCategory: v.reviewedCategory || v.sourceCategory || recommendation?.sourceCategory || "Unknown",
        finalCtaFlag: v.reviewedCtaFlag ?? v.ctaCandidate ?? recommendation?.ctaCandidate ?? false,
      };
    });

    // 그룹핑 (같은 원문/같은 추천값 묶음)
    let groups = null;
    if (groupBy === "raw") {
      const map = new Map<string, typeof items>();
      for (const item of items) {
        const key = item.sourceRaw || "(미입력)";
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
      groups = Object.fromEntries(
        [...map.entries()].sort((a, b) => b[1].length - a[1].length)
      );
    } else if (groupBy === "normalized") {
      const map = new Map<string, typeof items>();
      for (const item of items) {
        const key = item.finalSource;
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(item);
      }
      groups = Object.fromEntries(
        [...map.entries()].sort((a, b) => b[1].length - a[1].length)
      );
    }

    // 요약 통계
    const stats = {
      total: items.length,
      unreviewed: items.filter((i) => i.sourceReviewStatus === "unreviewed").length,
      autoConfirmed: items.filter((i) => i.sourceReviewStatus === "auto_confirmed").length,
      manuallyConfirmed: items.filter((i) => i.sourceReviewStatus === "manually_confirmed").length,
      lowConfidence: items.filter((i) => i.matchConfidence === "LOW").length,
      ctaCandidates: items.filter((i) => i.finalCtaFlag).length,
      unknownSource: items.filter((i) => i.finalSource === "Unknown").length,
    };

    return NextResponse.json({ items, groups, stats });
  } catch (error) {
    console.error("Source review GET error:", error);
    return NextResponse.json(
      { error: "방문경로 검토 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 일괄 정규화 실행 (아직 추천이 없는 방문에 시스템 추천 저장)
 */
export async function POST() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const dbRules = await prisma.sourceRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });
    const rules = dbRules.length > 0 ? dbRules.map(dbRuleToDefinition) : undefined;

    // 추천이 없는 방문만 대상 (tenant 스코핑)
    const scope = getTenantScope(session);
    const postWhere: Record<string, unknown> = {
      sourceRaw: { not: null },
      normalizedSource: null,
    };
    if (scope.tenantId) {
      postWhere.patient = { tenantId: scope.tenantId };
    }
    const visits = await prisma.visit.findMany({
      where: postWhere,
    });

    let updated = 0;
    for (const v of visits) {
      const result = normalizeSource(v.sourceRaw, rules);

      // 매칭된 규칙의 DB ID 조회
      let matchedRuleId: string | null = null;
      if (result.matchedRuleName && dbRules.length > 0) {
        const matched = dbRules.find((r) => r.ruleName === result.matchedRuleName);
        matchedRuleId = matched?.id || null;
      }

      await prisma.visit.update({
        where: { id: v.id },
        data: {
          normalizedSource: result.normalizedSource,
          sourceCategory: result.sourceCategory,
          ctaCandidate: result.ctaCandidate,
          matchConfidence: result.matchConfidence,
          matchReason: result.matchReason,
          matchedRuleId,
          // HIGH 신뢰도는 자동 확정
          sourceReviewStatus: result.matchConfidence === "HIGH" ? "auto_confirmed" : "unreviewed",
          ...(result.matchConfidence === "HIGH"
            ? {
                reviewedSource: result.normalizedSource,
                reviewedCategory: result.sourceCategory,
                reviewedCtaFlag: result.ctaCandidate,
              }
            : {}),
        },
      });
      updated++;
    }

    return NextResponse.json({
      success: true,
      message: `${updated}건의 방문경로가 정규화되었습니다.`,
      updated,
    });
  } catch (error) {
    console.error("Source review POST error:", error);
    return NextResponse.json(
      { error: "일괄 정규화 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/**
 * 개별 방문 경로 검토 확정/수정
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const body = await request.json();
    const { visitId, reviewedSource, reviewedCategory, reviewedCtaFlag, sourceReviewMemo, action } = body as {
      visitId: string;
      reviewedSource?: string;
      reviewedCategory?: string;
      reviewedCtaFlag?: boolean;
      sourceReviewMemo?: string;
      action?: "confirm" | "reject" | "confirm_recommended";
    };

    if (!visitId) {
      return NextResponse.json({ error: "visitId가 필요합니다." }, { status: 400 });
    }

    const visit = await prisma.visit.findUnique({
      where: { id: visitId },
      include: { patient: { select: { tenantId: true } } },
    });
    if (!visit) {
      return NextResponse.json({ error: "방문 기록을 찾을 수 없습니다." }, { status: 404 });
    }
    // tenant 접근 검증
    const scope = getTenantScope(session);
    if (scope.tenantId && visit.patient.tenantId && visit.patient.tenantId !== scope.tenantId) {
      return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
    }

    const data: Record<string, unknown> = {
      sourceReviewedAt: new Date(),
      sourceReviewedBy: session.name,
    };

    if (action === "confirm_recommended") {
      // 시스템 추천값 그대로 확정
      data.reviewedSource = visit.normalizedSource;
      data.reviewedCategory = visit.sourceCategory;
      data.reviewedCtaFlag = visit.ctaCandidate;
      data.sourceReviewStatus = "manually_confirmed";
    } else if (action === "reject") {
      data.sourceReviewStatus = "rejected";
    } else {
      // 수동 수정
      if (reviewedSource !== undefined) data.reviewedSource = reviewedSource;
      if (reviewedCategory !== undefined) data.reviewedCategory = reviewedCategory;
      if (typeof reviewedCtaFlag === "boolean") data.reviewedCtaFlag = reviewedCtaFlag;
      data.sourceReviewStatus = "manually_confirmed";
    }

    if (sourceReviewMemo !== undefined) data.sourceReviewMemo = sourceReviewMemo;

    const updated = await prisma.visit.update({
      where: { id: visitId },
      data,
    });

    // 정규화 변경 이력 기록
    await prisma.sourceNormalizationHistory.create({
      data: {
        visitId,
        prevNormalizedSource: visit.reviewedSource || visit.normalizedSource,
        prevCategory: visit.reviewedCategory || visit.sourceCategory,
        prevCtaCandidate: visit.reviewedCtaFlag ?? visit.ctaCandidate,
        prevReviewStatus: visit.sourceReviewStatus,
        newNormalizedSource: (data.reviewedSource as string) || visit.normalizedSource,
        newCategory: (data.reviewedCategory as string) || visit.sourceCategory,
        newCtaCandidate: typeof data.reviewedCtaFlag === "boolean" ? data.reviewedCtaFlag : visit.ctaCandidate,
        newReviewStatus: data.sourceReviewStatus as string,
        changeType: "individual_review",
        changedBy: session.name,
        changeMemo: sourceReviewMemo || null,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "source_review",
        entityType: "visit",
        entityId: visitId,
        detail: JSON.stringify({ action, reviewedSource: data.reviewedSource, reviewedCategory: data.reviewedCategory }),
      },
    });

    return NextResponse.json({ success: true, visit: updated });
  } catch (error) {
    console.error("Source review PATCH error:", error);
    return NextResponse.json(
      { error: "검토 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
