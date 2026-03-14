import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionWithScope, requireProductArea } from "@/lib/api-auth";

/**
 * 홈 대시보드 부가 통계 (CTA, 워크플로우, 방문경로, 동기화, 메시지)
 * 클라이언트에서 lazy fetch하여 첫 렌더 차단을 제거합니다.
 */
export async function GET() {
  try {
    const { session, scope, error } = await requireSessionWithScope();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // 테넌트 스코프: patient.tenantId 기준 필터링
    const tenantWhere = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};
    const patientTenantWhere = scope.tenantId ? { tenantId: scope.tenantId } : {};

    // 모든 독립 쿼리를 병렬 실행
    const [
      workflowTasks,
      ctaAttributions,
      srTotal,
      srUnreviewed,
      srLowConf,
      srUnclassified,
      srRecentImport,
      msgReviewNeeded,
      msgApproved,
      msgSentToday,
      msgFailed,
      msgBlocked,
      syncJobs,
    ] = await Promise.all([
      // 워크플로우 (patient.tenantId 기준)
      prisma.workflowTask.findMany({
        where: { status: { notIn: ["completed", "excluded"] }, ...tenantWhere },
        select: { status: true, nextFollowUpAt: true },
      }),
      // CTA (visit→patient.tenantId 기준)
      prisma.leadAttribution.findMany({
        where: scope.tenantId ? { visit: { patient: { tenantId: scope.tenantId } } } : {},
        select: { reviewStatus: true, settlementEligible: true },
      }),
      // 방문경로 (patient.tenantId 기준)
      prisma.visit.count({ where: { sourceRaw: { not: null }, patient: patientTenantWhere } }),
      prisma.visit.count({ where: { sourceRaw: { not: null }, sourceReviewStatus: "unreviewed", patient: patientTenantWhere } }),
      prisma.visit.count({ where: { sourceRaw: { not: null }, matchConfidence: "LOW", patient: patientTenantWhere } }),
      prisma.visit.count({ where: { normalizedSource: "Unknown", patient: patientTenantWhere } }),
      prisma.importBatch.findFirst({
        orderBy: { createdAt: "desc" },
        select: { createdAt: true, fileName: true, successCount: true },
      }).catch(() => null),
      // 메시지 (patient.tenantId 기준)
      prisma.outboundMessage.count({ where: { approvalStatus: "REVIEW_NEEDED", ...tenantWhere } }).catch(() => 0),
      prisma.outboundMessage.count({ where: { approvalStatus: "APPROVED", sendStatus: "PENDING", ...tenantWhere } }).catch(() => 0),
      prisma.outboundMessage.count({ where: { sendStatus: "SENT", sentAt: { gte: todayStart }, ...tenantWhere } }).catch(() => 0),
      prisma.outboundMessage.count({ where: { sendStatus: { in: ["FAILED", "RETRY_NEEDED"] }, ...tenantWhere } }).catch(() => 0),
      prisma.outboundMessage.count({ where: { OR: [{ doNotContactBlocked: true }, { duplicateBlocked: true }], ...tenantWhere } }).catch(() => 0),
      // 동기화 (전역 — 테넌트 무관)
      prisma.syncJob.findMany({
        select: { status: true, startedAt: true },
        orderBy: { startedAt: "desc" },
        take: 50,
      }).catch(() => [] as { status: string; startedAt: Date }[]),
    ]);

    // 워크플로우 집계
    const workflowSummary = {
      totalActive: workflowTasks.length,
      unprocessed: workflowTasks.filter((t) => t.status === "unprocessed").length,
      todayFollowUps: workflowTasks.filter((t) =>
        t.nextFollowUpAt && t.nextFollowUpAt >= todayStart && t.nextFollowUpAt <= todayEnd
      ).length,
      overdueFollowUps: workflowTasks.filter((t) =>
        t.nextFollowUpAt && t.nextFollowUpAt < todayStart
      ).length,
    };

    // CTA 집계
    const ctaStats = {
      totalLeads: ctaAttributions.length,
      pendingReview: ctaAttributions.filter((a) => a.reviewStatus === "pending").length,
      confirmed: ctaAttributions.filter((a) => a.reviewStatus === "confirmed").length,
      settlementEligible: ctaAttributions.filter((a) => a.settlementEligible).length,
    };

    // 방문경로 검토
    const sourceReviewStats = {
      totalWithSource: srTotal,
      unreviewedCount: srUnreviewed,
      lowConfidenceCount: srLowConf,
      unclassifiedCount: srUnclassified,
      recentImport: srRecentImport ? {
        fileName: srRecentImport.fileName,
        importedAt: srRecentImport.createdAt.toISOString(),
        count: srRecentImport.successCount,
      } : null,
    };

    // 메시지 발송
    const messageStats = {
      reviewNeeded: msgReviewNeeded,
      approved: msgApproved,
      sentToday: msgSentToday,
      failed: msgFailed,
      blocked: msgBlocked,
    };

    // 동기화
    const syncStats = {
      lastSync: syncJobs[0]?.startedAt?.toISOString() || null,
      lastSyncStatus: syncJobs[0]?.status || null,
      failedCount: syncJobs.filter((j) => j.status === "FAILED").length,
      runningCount: syncJobs.filter((j) => j.status === "RUNNING").length,
    };

    const response = NextResponse.json({
      ctaStats,
      workflowSummary,
      sourceReviewStats,
      messageStats,
      syncStats,
    });

    // 부가 통계는 30초 브라우저 캐시 허용
    response.headers.set("Cache-Control", "private, max-age=30, stale-while-revalidate=60");
    return response;
  } catch (error) {
    console.error("[CareFlow] Secondary stats error:", error);
    return NextResponse.json(
      { error: "부가 통계를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
