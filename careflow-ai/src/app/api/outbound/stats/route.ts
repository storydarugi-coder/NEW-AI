import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * 발송 메시지 통계 API
 * GET /api/outbound/stats
 */

export async function GET() {
  try {
    const { session: user, error: authErr } = await requireSession();
    if (authErr) return authErr;
    const areaError = requireProductArea(user, "hospital");
    if (areaError) return areaError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const [
      reviewNeeded,
      approved,
      scheduledToday,
      sentToday,
      failed,
      retryNeeded,
      blocked,
      totalSent,
    ] = await Promise.all([
      prisma.outboundMessage.count({ where: { approvalStatus: "REVIEW_NEEDED" } }),
      prisma.outboundMessage.count({ where: { approvalStatus: "APPROVED", sendStatus: "PENDING" } }),
      prisma.outboundMessage.count({
        where: { sendStatus: "SCHEDULED", scheduledAt: { gte: today, lte: todayEnd } },
      }),
      prisma.outboundMessage.count({
        where: { sendStatus: "SENT", sentAt: { gte: today } },
      }),
      prisma.outboundMessage.count({ where: { sendStatus: "FAILED" } }),
      prisma.outboundMessage.count({ where: { sendStatus: "RETRY_NEEDED" } }),
      prisma.outboundMessage.count({ where: { sendStatus: "BLOCKED" } }),
      prisma.outboundMessage.count({ where: { sendStatus: "SENT" } }),
    ]);

    return NextResponse.json({
      reviewNeeded,
      approved,
      scheduledToday,
      sentToday,
      failed,
      retryNeeded,
      blocked,
      totalSent,
    });
  } catch (error) {
    console.error("Outbound stats error:", error);
    return NextResponse.json({ error: "통계 조회 실패" }, { status: 500 });
  }
}
