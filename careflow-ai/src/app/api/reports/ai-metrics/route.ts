import { NextRequest, NextResponse } from "next/server";
import { collectOperationsMetrics } from "@/lib/ai/metrics";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * GET /api/reports/ai-metrics
 * AI 메시지 생성 운영 메트릭: 생성 유형 비율, fallback율, 발송 성공률, 차단 사유
 */
// internal: AI 운영 메트릭은 내부 운영 도메인
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;

    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));
    const metrics = await collectOperationsMetrics(from, to);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[CareFlow] AI 메트릭 API 오류:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "메트릭을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}
