import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

/**
 * GET /api/reports/sources
 * 방문경로/채널 리포트: 상위 소스, 카테고리별, CTA 후보 vs 확정, 미분류
 */
// internal: 유입경로 분석은 내부 운영 도메인
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    const dateFilter = { gte: from, lte: to };

    // tenant 스코핑
    const scope = getTenantScope(session);
    const tenantFilter = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};

    // 정규화 소스별 방문수 (상위 15)
    const bySource = await prisma.visit.groupBy({
      by: ["normalizedSource"],
      where: { visitDate: dateFilter, sourceRaw: { not: null }, ...tenantFilter },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: 15,
    });

    // 카테고리별 방문수
    const byCategory = await prisma.visit.groupBy({
      by: ["sourceCategory"],
      where: { visitDate: dateFilter, sourceRaw: { not: null }, ...tenantFilter },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
    });

    // CTA 후보 vs 확정
    const [ctaCandidateCount, ctaConfirmedCount] = await Promise.all([
      prisma.visit.count({ where: { ctaCandidate: true, visitDate: dateFilter, ...tenantFilter } }),
      prisma.visit.count({ where: { sourceReviewStatus: { in: ["auto_confirmed", "manually_confirmed"] }, ctaCandidate: true, visitDate: dateFilter, ...tenantFilter } }),
    ]);

    // 미분류
    const unclassifiedCount = await prisma.visit.count({
      where: { normalizedSource: "Unknown", visitDate: dateFilter, ...tenantFilter },
    });

    // 검토 상태별
    const byReviewStatus = await prisma.visit.groupBy({
      by: ["sourceReviewStatus"],
      where: { visitDate: dateFilter, sourceRaw: { not: null }, ...tenantFilter },
      _count: { id: true },
    });

    // 신뢰도별
    const byConfidence = await prisma.visit.groupBy({
      by: ["matchConfidence"],
      where: { visitDate: dateFilter, sourceRaw: { not: null }, ...tenantFilter },
      _count: { id: true },
    });

    const reviewLabels: Record<string, string> = {
      unreviewed: "미검토",
      auto_confirmed: "자동 확정",
      manually_confirmed: "수동 확정",
      rejected: "반려",
    };

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      topSources: bySource.map((r) => ({
        source: r.normalizedSource || "미분류",
        count: r._count.id,
      })),
      byCategory: byCategory.map((r) => ({
        category: r.sourceCategory || "미분류",
        count: r._count.id,
      })),
      ctaFunnel: {
        candidates: ctaCandidateCount,
        confirmed: ctaConfirmedCount,
        conversionRate: ctaCandidateCount > 0 ? Math.round((ctaConfirmedCount / ctaCandidateCount) * 100) : 0,
      },
      unclassified: unclassifiedCount,
      byReviewStatus: byReviewStatus.map((r) => ({
        status: r.sourceReviewStatus,
        label: reviewLabels[r.sourceReviewStatus] || r.sourceReviewStatus,
        count: r._count.id,
      })),
      byConfidence: byConfidence.map((r) => ({
        confidence: r.matchConfidence || "없음",
        count: r._count.id,
      })),
    });
  } catch (error) {
    console.error("[Reports] 소스 리포트 조회 실패:", error);
    return NextResponse.json({ error: "소스 리포트 조회 실패" }, { status: 500 });
  }
}
