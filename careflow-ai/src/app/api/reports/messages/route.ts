import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession } from "@/lib/api-auth";

/**
 * GET /api/reports/messages
 * 메시지 재내원 성과: 유형별, 승인 대기, 스케줄, 실패/재시도, 차단 사유 분포
 */
// shared: 병원(재내원 성과)과 내부(운영 분석) 양쪽에서 사용하므로 productArea 제한 없음
export async function GET(req: NextRequest) {
  try {
    const { error } = await requireSession();
    if (error) return error;

    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    const dateFilter = { gte: from, lte: to };

    // 유형별 발송 통계
    const byType = await prisma.outboundMessage.groupBy({
      by: ["messageType"],
      where: { createdAt: dateFilter },
      _count: { id: true },
    });

    // 승인 상태별 통계
    const byApproval = await prisma.outboundMessage.groupBy({
      by: ["approvalStatus"],
      where: { createdAt: dateFilter },
      _count: { id: true },
    });

    // 발송 상태별 통계
    const bySendStatus = await prisma.outboundMessage.groupBy({
      by: ["sendStatus"],
      where: { createdAt: dateFilter },
      _count: { id: true },
    });

    // 차단 사유 분포
    const [doNotContactCount, duplicateCount] = await Promise.all([
      prisma.outboundMessage.count({ where: { doNotContactBlocked: true, createdAt: dateFilter } }),
      prisma.outboundMessage.count({ where: { duplicateBlocked: true, createdAt: dateFilter } }),
    ]);

    // 채널별 통계
    const byChannel = await prisma.outboundMessage.groupBy({
      by: ["channel"],
      where: { createdAt: dateFilter },
      _count: { id: true },
    });

    // 스케줄 대기
    const scheduledCount = await prisma.outboundMessage.count({
      where: { sendStatus: "SCHEDULED", scheduledAt: { gte: new Date() } },
    });

    const typeLabels: Record<string, string> = {
      RECALL: "리콜 알림",
      CTA_FOLLOWUP: "CTA 후속",
      TREATMENT_RESUME: "치료 재개",
      COUNSELING_FOLLOWUP: "상담 후속",
      SCALING_REMINDER: "스케일링 안내",
      GENERAL: "일반",
    };

    const approvalLabels: Record<string, string> = {
      DRAFT: "초안",
      REVIEW_NEEDED: "검토 필요",
      APPROVED: "승인",
      REJECTED: "반려",
    };

    const sendLabels: Record<string, string> = {
      PENDING: "대기",
      SCHEDULED: "예약",
      SENDING: "발송중",
      SENT: "성공",
      FAILED: "실패",
      RETRY_NEEDED: "재시도",
      CANCELLED: "취소",
      BLOCKED: "차단",
    };

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      byType: byType.map((r) => ({
        type: r.messageType,
        label: typeLabels[r.messageType] || r.messageType,
        count: r._count.id,
      })),
      byApproval: byApproval.map((r) => ({
        status: r.approvalStatus,
        label: approvalLabels[r.approvalStatus] || r.approvalStatus,
        count: r._count.id,
      })),
      bySendStatus: bySendStatus.map((r) => ({
        status: r.sendStatus,
        label: sendLabels[r.sendStatus] || r.sendStatus,
        count: r._count.id,
      })),
      blockReasons: {
        doNotContact: doNotContactCount,
        duplicate: duplicateCount,
        total: doNotContactCount + duplicateCount,
      },
      byChannel: byChannel.map((r) => ({
        channel: r.channel,
        count: r._count.id,
      })),
      scheduled: scheduledCount,
    });
  } catch (error) {
    console.error("[Reports] 메시지 리포트 조회 실패:", error);
    return NextResponse.json({ error: "메시지 리포트 조회 실패" }, { status: 500 });
  }
}
