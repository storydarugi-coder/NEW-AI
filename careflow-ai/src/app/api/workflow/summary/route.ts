import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireProductArea } from "@/lib/api-auth";

export async function GET() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    const [
      totalUnprocessed,
      totalReviewing,
      totalWaitingContact,
      totalOnHold,
      totalCompleted,
      totalExcluded,
      totalRecheckScheduled,
      todayFollowUps,
      weekFollowUps,
      overdueFollowUps,
    ] = await Promise.all([
      prisma.workflowTask.count({ where: { status: "unprocessed" } }),
      prisma.workflowTask.count({ where: { status: "reviewing" } }),
      prisma.workflowTask.count({ where: { status: "waiting_contact" } }),
      prisma.workflowTask.count({ where: { status: "on_hold" } }),
      prisma.workflowTask.count({ where: { status: "completed" } }),
      prisma.workflowTask.count({ where: { status: "excluded" } }),
      prisma.workflowTask.count({ where: { status: "recheck_scheduled" } }),
      prisma.workflowTask.count({
        where: {
          nextFollowUpAt: { gte: todayStart, lte: todayEnd },
          status: { notIn: ["completed", "excluded"] },
        },
      }),
      prisma.workflowTask.count({
        where: {
          nextFollowUpAt: { gte: todayStart, lte: weekEnd },
          status: { notIn: ["completed", "excluded"] },
        },
      }),
      prisma.workflowTask.count({
        where: {
          nextFollowUpAt: { lt: todayStart },
          status: { notIn: ["completed", "excluded"] },
        },
      }),
    ]);

    // 담당자별 미처리 현황
    const assigneeSummary = await prisma.workflowTask.groupBy({
      by: ["assigneeId"],
      where: { status: { notIn: ["completed", "excluded"] } },
      _count: true,
    });

    return NextResponse.json({
      statusCounts: {
        unprocessed: totalUnprocessed,
        reviewing: totalReviewing,
        waiting_contact: totalWaitingContact,
        on_hold: totalOnHold,
        completed: totalCompleted,
        excluded: totalExcluded,
        recheck_scheduled: totalRecheckScheduled,
      },
      followUps: {
        today: todayFollowUps,
        week: weekFollowUps,
        overdue: overdueFollowUps,
      },
      assigneeSummary,
      totalActive: totalUnprocessed + totalReviewing + totalWaitingContact + totalOnHold + totalRecheckScheduled,
    });
  } catch {
    return NextResponse.json({ error: "요약 정보를 불러올 수 없습니다." }, { status: 500 });
  }
}
