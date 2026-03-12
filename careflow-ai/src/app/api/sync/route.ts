import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";

/**
 * 동기화 작업 API
 *
 * GET  /api/sync — 동기화 이력 목록
 * POST /api/sync — 수동 동기화 실행 (stub)
 */

export async function GET(request: NextRequest) {
  try {
    const user = verifySession(request.cookies.get("session")?.value);
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "30");
    const status = searchParams.get("status"); // SUCCESS, FAILED, PARTIAL_SUCCESS 등

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [jobs, stats] = await Promise.all([
      prisma.syncJob.findMany({
        where,
        orderBy: { startedAt: "desc" },
        take: limit,
      }),
      prisma.syncJob.aggregate({
        _count: true,
      }),
    ]);

    // 요약 통계
    const allJobs = await prisma.syncJob.findMany({
      select: { status: true, startedAt: true },
      orderBy: { startedAt: "desc" },
      take: 100,
    });

    const summary = {
      total: stats._count,
      success: allJobs.filter((j) => j.status === "SUCCESS").length,
      partialSuccess: allJobs.filter((j) => j.status === "PARTIAL_SUCCESS")
        .length,
      failed: allJobs.filter((j) => j.status === "FAILED").length,
      running: allJobs.filter((j) => j.status === "RUNNING").length,
      lastSync: allJobs[0]?.startedAt?.toISOString() || null,
      lastSyncStatus: allJobs[0]?.status || null,
    };

    return NextResponse.json({
      jobs: jobs.map((j) => ({
        ...j,
        startedAt: j.startedAt.toISOString(),
        finishedAt: j.finishedAt?.toISOString() || null,
        createdAt: j.createdAt.toISOString(),
        updatedAt: j.updatedAt.toISOString(),
      })),
      summary,
    });
  } catch (error) {
    console.error("Sync GET error:", error);
    return NextResponse.json(
      { error: "동기화 이력 조회 실패" },
      { status: 500 }
    );
  }
}
