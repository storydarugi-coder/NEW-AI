import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession } from "@/lib/api-auth";

/**
 * GET /api/reports/sync
 * 동기화/데이터 품질 리포트: 성공/실패 추이, 미분류 비율, Import 건수
 */
// shared: 병원(재내원 성과)과 내부(운영 분석) 양쪽에서 사용하므로 productArea 제한 없음
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireSession();
    if (error) return error;

    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    const dateFilter = { gte: from, lte: to };

    // SyncJob 상태별 통계
    const syncJobs = await prisma.syncJob.findMany({
      where: { startedAt: dateFilter },
      select: {
        id: true,
        syncType: true,
        status: true,
        startedAt: true,
        totalRecords: true,
        successCount: true,
        failedCount: true,
        unclassifiedCount: true,
      },
      orderBy: { startedAt: "desc" },
    });

    const byStatus = syncJobs.reduce<Record<string, number>>((acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1;
      return acc;
    }, {});

    const byType = syncJobs.reduce<Record<string, number>>((acc, j) => {
      acc[j.syncType] = (acc[j.syncType] || 0) + 1;
      return acc;
    }, {});

    const totalRecords = syncJobs.reduce((s, j) => s + j.totalRecords, 0);
    const totalSuccess = syncJobs.reduce((s, j) => s + j.successCount, 0);
    const totalFailed = syncJobs.reduce((s, j) => s + j.failedCount, 0);
    const totalUnclassified = syncJobs.reduce((s, j) => s + j.unclassifiedCount, 0);

    // ImportBatch 통계
    const imports = await prisma.importBatch.findMany({
      where: { createdAt: dateFilter },
      select: {
        id: true,
        fileName: true,
        totalRows: true,
        successCount: true,
        failCount: true,
        unclassifiedCount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // 데이터 품질 지표
    const [totalVisits, unknownSource, lowConfidence] = await Promise.all([
      prisma.visit.count({ where: { sourceRaw: { not: null } } }),
      prisma.visit.count({ where: { normalizedSource: "Unknown" } }),
      prisma.visit.count({ where: { matchConfidence: "LOW" } }),
    ]);

    const statusLabels: Record<string, string> = {
      PENDING: "대기",
      RUNNING: "실행중",
      SUCCESS: "성공",
      PARTIAL_SUCCESS: "부분 성공",
      FAILED: "실패",
    };

    const typeLabels: Record<string, string> = {
      CSV_IMPORT: "CSV 가져오기",
      EMR_PULL: "EMR 동기화",
      MANUAL_REPROCESS: "수동 재처리",
      SEED: "시드 데이터",
    };

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalJobs: syncJobs.length,
        totalRecords,
        totalSuccess,
        totalFailed,
        totalUnclassified,
        successRate: totalRecords > 0 ? Math.round((totalSuccess / totalRecords) * 100) : 0,
      },
      byStatus: Object.entries(byStatus).map(([status, count]) => ({
        status,
        label: statusLabels[status] || status,
        count,
      })),
      byType: Object.entries(byType).map(([type, count]) => ({
        type,
        label: typeLabels[type] || type,
        count,
      })),
      recentJobs: syncJobs.slice(0, 10).map((j) => ({
        id: j.id,
        type: j.syncType,
        typeLabel: typeLabels[j.syncType] || j.syncType,
        status: j.status,
        statusLabel: statusLabels[j.status] || j.status,
        startedAt: j.startedAt.toISOString(),
        records: j.totalRecords,
        success: j.successCount,
        failed: j.failedCount,
      })),
      imports: imports.map((i) => ({
        id: i.id,
        fileName: i.fileName,
        totalRows: i.totalRows,
        success: i.successCount,
        failed: i.failCount,
        unclassified: i.unclassifiedCount,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      })),
      dataQuality: {
        totalWithSource: totalVisits,
        unknownSource,
        lowConfidence,
        unknownRate: totalVisits > 0 ? Math.round((unknownSource / totalVisits) * 100) : 0,
        lowConfidenceRate: totalVisits > 0 ? Math.round((lowConfidence / totalVisits) * 100) : 0,
      },
    });
  } catch (error) {
    console.error("[Reports] 동기화 리포트 조회 실패:", error);
    return NextResponse.json({ error: "동기화 리포트 조회 실패" }, { status: 500 });
  }
}
