import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession } from "@/lib/auth";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";

/**
 * POST /api/workflow/tasks/complete-by-patient
 * 환자 ID 기준으로 미완료 업무를 일괄 완료 처리.
 * /workflow "연락 완료" 버튼에서 호출.
 */
export async function POST(request: NextRequest) {
  try {
    const user = verifySession(request.cookies.get("session")?.value);
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const body = await request.json();
    const { patientId } = body;

    if (!patientId) {
      return NextResponse.json({ error: "patientId가 필요합니다." }, { status: 400 });
    }

    // 해당 환자의 미완료 업무 조회
    const activeTasks = await prisma.workflowTask.findMany({
      where: {
        patientId,
        status: { notIn: ["completed", "excluded"] },
      },
    });

    if (activeTasks.length === 0) {
      // 업무가 없어도 성공으로 처리 (이미 완료 또는 업무 미존재)
      return NextResponse.json({ success: true, completedCount: 0 });
    }

    const now = new Date();
    const taskIds = activeTasks.map((t) => t.id);

    // 일괄 완료 처리
    await prisma.workflowTask.updateMany({
      where: { id: { in: taskIds } },
      data: {
        status: "completed",
        completedAt: now,
        reason: "연락 완료",
      },
    });

    // 활동 로그 기록
    await prisma.activityLog.createMany({
      data: activeTasks.map((t) => ({
        taskId: t.id,
        patientId,
        action: "status_change",
        fromValue: t.status,
        toValue: "completed",
        detail: JSON.stringify({ completedVia: "workflow_contact_complete", user: user.name }),
      })),
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "complete_workflow_task",
        entityType: "patient",
        entityId: patientId,
        userId: user.id,
        detail: JSON.stringify({
          user: user.name,
          patientId,
          taskIds,
          completedCount: taskIds.length,
        }),
      },
    });

    onDashboardDataChanged();

    return NextResponse.json({
      success: true,
      completedCount: taskIds.length,
    });
  } catch (error) {
    console.error("Complete by patient error:", error);
    return NextResponse.json({ error: "완료 처리에 실패했습니다." }, { status: 500 });
  }
}
