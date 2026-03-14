import { NextRequest, NextResponse } from "next/server";
import { collectOutcomeMetrics } from "@/lib/ai/outcome";
import { parsePeriod } from "@/lib/reports/period";

/**
 * GET /api/reports/outcome
 * 메시지 발송 → 재내원 전환 성과 메트릭
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));
    const windowDays = parseInt(sp.get("windowDays") || "30", 10);
    const metrics = await collectOutcomeMetrics(from, to, windowDays);

    return NextResponse.json(metrics);
  } catch (error) {
    console.error("[CareFlow] Outcome 메트릭 API 오류:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: "성과 메트릭을 조회할 수 없습니다." },
      { status: 500 }
    );
  }
}
