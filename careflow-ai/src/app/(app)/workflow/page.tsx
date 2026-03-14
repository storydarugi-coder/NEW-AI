import { prisma } from "@/lib/prisma";
import { WorkflowDashboardContent } from "@/components/workflow/workflow-dashboard-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export default async function WorkflowPage() {
  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    weekEnd.setHours(23, 59, 59, 999);

    // 전체 작업 조회 (미완료 우선)
    const tasks = await prisma.workflowTask.findMany({
      include: {
        patient: { include: { identity: true } },
        assignee: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: { staff: true },
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });

    // 통계 계산
    const statusCounts = {
      unprocessed: tasks.filter((t) => t.status === "unprocessed").length,
      reviewing: tasks.filter((t) => t.status === "reviewing").length,
      waiting_contact: tasks.filter((t) => t.status === "waiting_contact").length,
      on_hold: tasks.filter((t) => t.status === "on_hold").length,
      completed: tasks.filter((t) => t.status === "completed").length,
      excluded: tasks.filter((t) => t.status === "excluded").length,
      recheck_scheduled: tasks.filter((t) => t.status === "recheck_scheduled").length,
    };

    const todayFollowUps = tasks.filter((t) => {
      if (!t.nextFollowUpAt || t.status === "completed" || t.status === "excluded") return false;
      return t.nextFollowUpAt >= todayStart && t.nextFollowUpAt <= todayEnd;
    }).length;

    const weekFollowUps = tasks.filter((t) => {
      if (!t.nextFollowUpAt || t.status === "completed" || t.status === "excluded") return false;
      return t.nextFollowUpAt >= todayStart && t.nextFollowUpAt <= weekEnd;
    }).length;

    const overdueFollowUps = tasks.filter((t) => {
      if (!t.nextFollowUpAt || t.status === "completed" || t.status === "excluded") return false;
      return t.nextFollowUpAt < todayStart;
    }).length;

    const serializedTasks = tasks.map((t) => ({
      id: t.id,
      patientId: t.patientId,
      actionType: t.actionType,
      status: t.status,
      assigneeId: t.assigneeId,
      note: t.note,
      reason: t.reason,
      nextFollowUpAt: t.nextFollowUpAt?.toISOString() || null,
      completedAt: t.completedAt?.toISOString() || null,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      patientName: t.patient.identity?.name || t.patient.chartNumber,
      chartNumber: t.patient.chartNumber,
      isVip: t.patient.isVip,
      assigneeName: t.assignee?.name || null,
      assigneeRole: t.assignee?.role || null,
    }));

    return (
      <WorkflowDashboardContent
        tasks={serializedTasks}
        staff={staff.map((s) => ({ id: s.id, name: s.name, role: s.role }))}
        summary={{
          statusCounts,
          followUps: {
            today: todayFollowUps,
            week: weekFollowUps,
            overdue: overdueFollowUps,
          },
          totalActive: statusCounts.unprocessed + statusCounts.reviewing + statusCounts.waiting_contact + statusCounts.on_hold + statusCounts.recheck_scheduled,
        }}
      />
    );
  } catch (error) {
    console.error("[CareFlow] 업무 대시보드 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
