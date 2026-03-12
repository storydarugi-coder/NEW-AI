import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, hasCapability } from "@/lib/auth";
import { startSyncJob, completeSyncJob, failSyncJob } from "@/lib/sync/pipeline";
import { normalizeSource, dbRuleToDefinition } from "@/lib/attribution/normalizer";

/**
 * 동기화 재처리 API
 *
 * POST /api/sync/:id/reprocess — 미분류/실패 건 재처리
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifySession(request.cookies.get("session")?.value);
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    if (!hasCapability(user.role, "import_csv")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id: originalJobId } = await params;

    const originalJob = await prisma.syncJob.findUnique({
      where: { id: originalJobId },
    });
    if (!originalJob) {
      return NextResponse.json(
        { error: "원본 동기화 작업을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 미분류/미검토 Visit 재정규화
    const dbRules = await prisma.sourceRule.findMany({
      where: { isActive: true },
      orderBy: { priority: "asc" },
    });
    const rules = dbRules.length > 0 ? dbRules.map(dbRuleToDefinition) : undefined;

    // 미분류 방문 조회
    const unclassifiedVisits = await prisma.visit.findMany({
      where: {
        sourceRaw: { not: null },
        OR: [
          { normalizedSource: "Unknown" },
          { normalizedSource: null },
          { sourceReviewStatus: "unreviewed", matchConfidence: "LOW" },
        ],
      },
      take: 1000,
    });

    // 새 SyncJob 생성
    const newJob = await startSyncJob({
      syncType: "MANUAL_REPROCESS",
      sourceSystem: originalJob.sourceSystem as "csv" | "mock-emr" | "api" | "seed",
      triggeredBy: user.name,
      notes: `재처리: 원본 작업 ${originalJobId}. 미분류 ${unclassifiedVisits.length}건 대상`,
    });

    try {
      let successCount = 0;
      let failedCount = 0;
      let stillUnclassified = 0;

      for (const v of unclassifiedVisits) {
        try {
          const result = normalizeSource(v.sourceRaw, rules);
          const matchedRuleId =
            result.matchedRuleName && dbRules.length > 0
              ? dbRules.find((r) => r.ruleName === result.matchedRuleName)?.id || null
              : null;

          await prisma.visit.update({
            where: { id: v.id },
            data: {
              normalizedSource: result.normalizedSource,
              sourceCategory: result.sourceCategory,
              ctaCandidate: result.ctaCandidate,
              matchConfidence: result.matchConfidence,
              matchReason: result.matchReason,
              matchedRuleId,
              sourceReviewStatus:
                result.matchConfidence === "HIGH"
                  ? "auto_confirmed"
                  : "unreviewed",
              ...(result.matchConfidence === "HIGH"
                ? {
                    reviewedSource: result.normalizedSource,
                    reviewedCategory: result.sourceCategory,
                    reviewedCtaFlag: result.ctaCandidate,
                  }
                : {}),
            },
          });

          if (result.normalizedSource === "Unknown") stillUnclassified++;
          successCount++;
        } catch {
          failedCount++;
        }
      }

      await completeSyncJob(newJob.id, {
        totalRecords: unclassifiedVisits.length,
        successCount,
        failedCount,
        skippedCount: 0,
        duplicateCount: 0,
        unclassifiedCount: stillUnclassified,
      });

      return NextResponse.json({
        success: true,
        syncJobId: newJob.id,
        result: {
          total: unclassifiedVisits.length,
          successCount,
          failedCount,
          stillUnclassified,
        },
      });
    } catch (err) {
      await failSyncJob(newJob.id, String(err));
      throw err;
    }
  } catch (error) {
    console.error("Reprocess error:", error);
    return NextResponse.json(
      { error: "재처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
