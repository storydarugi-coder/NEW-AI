import { NextRequest, NextResponse } from "next/server";
import { collectOperationsMetrics } from "@/lib/ai/metrics";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession } from "@/lib/api-auth";

/**
 * GET /api/reports/ai-metrics
 * AI 메시지 생성 운영 메트릭: 생성 유형 비율, fallback율, 발송 성공률, 차단 사유
 */
// shared: 병원(재내원 성과)과 내부(운영 분석) 양쪽에서 사용하므로 productArea 제한 없음
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireSession();
    if (error) return error;

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
