import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";

/**
 * GET /api/reports/staff
 * 담당자별 재내원 성과: 처리 건수, 완료 수, 보류 수
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    const dateFilter = { gte: from, lte: to };

    // 전체 담당자 목록
    const staffList = await prisma.staff.findMany({
      where: { isActive: true },
      select: { id: true, name: true, role: true },
    });

    // 담당자별 업무 통계
    const staffStats = await Promise.all(
      staffList.map(async (staff) => {
        const [assigned, completed, onHold, reviewing, waitingContact] = await Promise.all([
          prisma.workflowTask.count({ where: { assigneeId: staff.id, createdAt: dateFilter } }),
          prisma.workflowTask.count({ where: { assigneeId: staff.id, status: "completed", completedAt: dateFilter } }),
          prisma.workflowTask.count({ where: { assigneeId: staff.id, status: "on_hold" } }),
          prisma.workflowTask.count({ where: { assigneeId: staff.id, status: "reviewing" } }),
          prisma.workflowTask.count({ where: { assigneeId: staff.id, status: "waiting_contact" } }),
        ]);

        // 해당 기간 활동 로그 수
        const activityCount = await prisma.activityLog.count({
          where: { staffId: staff.id, createdAt: dateFilter },
        });

        return {
          staffId: staff.id,
          name: staff.name,
          role: staff.role,
          assigned,
          completed,
          onHold,
          reviewing,
          waitingContact,
          activityCount,
          completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
        };
      })
    );

    // 미배정 업무
    const unassigned = await prisma.workflowTask.count({
      where: { assigneeId: null, status: { notIn: ["completed", "excluded"] } },
    });

    // 액션 유형별 현황
    const byActionType = await prisma.workflowTask.groupBy({
      by: ["actionType"],
      where: { createdAt: dateFilter },
      _count: { id: true },
    });

    const roleLabels: Record<string, string> = {
      desk: "데스크",
      counselor: "상담실장",
      doctor: "원장",
      manager: "관리자",
    };

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      staff: staffStats.map((s) => ({
        ...s,
        roleLabel: roleLabels[s.role] || s.role,
      })),
      unassigned,
      byActionType: byActionType.map((r) => ({
        type: r.actionType,
        count: r._count.id,
      })),
    });
  } catch (error) {
    console.error("[Reports] 담당자 리포트 조회 실패:", error);
    return NextResponse.json({ error: "담당자 리포트 조회 실패" }, { status: 500 });
  }
}
