import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * 동기화 작업 상세 API
 *
 * GET /api/sync/:id — 동기화 작업 상세 조회
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const { id } = await params;

    const job = await prisma.syncJob.findUnique({ where: { id } });
    if (!job) {
      return NextResponse.json(
        { error: "동기화 작업을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // importBatch 연결 정보
    let importBatch = null;
    if (job.importBatchId) {
      importBatch = await prisma.importBatch.findUnique({
        where: { id: job.importBatchId },
      });
    }

    return NextResponse.json({
      job: {
        ...job,
        startedAt: job.startedAt.toISOString(),
        finishedAt: job.finishedAt?.toISOString() || null,
        createdAt: job.createdAt.toISOString(),
        updatedAt: job.updatedAt.toISOString(),
      },
      importBatch,
    });
  } catch (error) {
    console.error("Sync detail error:", error);
    return NextResponse.json(
      { error: "동기화 상세 조회 실패" },
      { status: 500 }
    );
  }
}
