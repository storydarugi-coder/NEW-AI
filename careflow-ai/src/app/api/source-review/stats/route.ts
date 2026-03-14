import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * 방문경로 검토 통계 (대시보드 위젯용)
 *
 * GET /api/source-review/stats
 */

export async function GET() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const [
      totalWithSource,
      unreviewedCount,
      lowConfidenceCount,
      unclassifiedCount,
      recentImport,
    ] = await Promise.all([
      prisma.visit.count({ where: { sourceRaw: { not: null } } }),
      prisma.visit.count({ where: { sourceRaw: { not: null }, sourceReviewStatus: "unreviewed" } }),
      prisma.visit.count({ where: { sourceRaw: { not: null }, matchConfidence: "LOW" } }),
      prisma.visit.count({ where: { normalizedSource: "Unknown" } }),
      prisma.importBatch.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true, fileName: true, successCount: true } }),
    ]);

    return NextResponse.json({
      totalWithSource,
      unreviewedCount,
      lowConfidenceCount,
      unclassifiedCount,
      todayReviewNeeded: unreviewedCount,
      recentImport: recentImport ? {
        fileName: recentImport.fileName,
        importedAt: recentImport.createdAt.toISOString(),
        count: recentImport.successCount,
      } : null,
    });
  } catch (error) {
    console.error("Source review stats error:", error);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
