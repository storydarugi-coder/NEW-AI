import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";

/**
 * GET /api/reports/kpi
 * KPI 카드 데이터: CTA 유입, 확정, 진료개시, 정산 대상, 메시지 발송/실패/차단
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    // CTA KPI
    const [ctaTotal, ctaConfirmed, ctaTreatmentStarted, ctaSettlement, ctaRejected] = await Promise.all([
      prisma.leadAttribution.count({ where: { createdAt: { gte: from, lte: to } } }),
      prisma.leadAttribution.count({ where: { reviewStatus: "confirmed", createdAt: { gte: from, lte: to } } }),
      prisma.leadAttribution.count({ where: { treatmentStarted: true, createdAt: { gte: from, lte: to } } }),
      prisma.leadAttribution.count({ where: { settlementEligible: true, createdAt: { gte: from, lte: to } } }),
      prisma.leadAttribution.count({ where: { reviewStatus: "rejected", createdAt: { gte: from, lte: to } } }),
    ]);

    // 메시지 KPI
    const [msgSent, msgFailed, msgBlocked, msgPending, msgTotal] = await Promise.all([
      prisma.outboundMessage.count({ where: { sendStatus: "SENT", createdAt: { gte: from, lte: to } } }),
      prisma.outboundMessage.count({ where: { sendStatus: { in: ["FAILED", "RETRY_NEEDED"] }, createdAt: { gte: from, lte: to } } }),
      prisma.outboundMessage.count({ where: { OR: [{ doNotContactBlocked: true }, { duplicateBlocked: true }], createdAt: { gte: from, lte: to } } }),
      prisma.outboundMessage.count({ where: { approvalStatus: "REVIEW_NEEDED", createdAt: { gte: from, lte: to } } }),
      prisma.outboundMessage.count({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    // 방문 KPI
    const [visitTotal, newPatients] = await Promise.all([
      prisma.visit.count({ where: { visitDate: { gte: from, lte: to } } }),
      prisma.patient.count({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    // 업무 KPI
    const [tasksCompleted, tasksCreated] = await Promise.all([
      prisma.workflowTask.count({ where: { completedAt: { gte: from, lte: to } } }),
      prisma.workflowTask.count({ where: { createdAt: { gte: from, lte: to } } }),
    ]);

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      cta: {
        total: ctaTotal,
        confirmed: ctaConfirmed,
        treatmentStarted: ctaTreatmentStarted,
        settlementEligible: ctaSettlement,
        rejected: ctaRejected,
        confirmRate: ctaTotal > 0 ? Math.round((ctaConfirmed / ctaTotal) * 100) : 0,
      },
      messages: {
        total: msgTotal,
        sent: msgSent,
        failed: msgFailed,
        blocked: msgBlocked,
        pending: msgPending,
        successRate: msgTotal > 0 ? Math.round((msgSent / msgTotal) * 100) : 0,
      },
      visits: { total: visitTotal, newPatients },
      tasks: { completed: tasksCompleted, created: tasksCreated },
    });
  } catch (error) {
    console.error("[Reports] KPI 조회 실패:", error);
    return NextResponse.json({ error: "KPI 데이터 조회 실패" }, { status: 500 });
  }
}
