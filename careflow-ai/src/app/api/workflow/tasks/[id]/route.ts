import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VALID_TASK_STATUSES } from "@/types";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET: 단일 업무 상세 조회
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const task = await prisma.workflowTask.findUnique({
      where: { id },
      include: {
        patient: { include: { identity: true } },
        assignee: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { staff: true },
        },
      },
    });
    if (!task) {
      return NextResponse.json({ error: "존재하지 않는 업무입니다." }, { status: 404 });
    }
    return NextResponse.json(task);
  } catch {
    return NextResponse.json({ error: "업무를 불러올 수 없습니다." }, { status: 500 });
  }
}

// PATCH: 업무 수정 (상태 변경, 담당자 변경, 메모, 다음 확인일 등)
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, assigneeId, note, reason, nextFollowUpAt, staffId } = body;

    const existing = await prisma.workflowTask.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "존재하지 않는 업무입니다." }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};
    const activities: {
      taskId: string;
      patientId: string;
      staffId?: string;
      action: string;
      fromValue?: string;
      toValue?: string;
      detail?: string;
    }[] = [];

    // 상태 변경
    if (status !== undefined) {
      if (!VALID_TASK_STATUSES.includes(status)) {
        return NextResponse.json({ error: `유효하지 않은 상태입니다. 허용: ${VALID_TASK_STATUSES.join(", ")}` }, { status: 400 });
      }
      updateData.status = status;
      if (status === "completed") {
        updateData.completedAt = new Date();
      }
      activities.push({
        taskId: id,
        patientId: existing.patientId,
        staffId: staffId || undefined,
        action: "status_change",
        fromValue: existing.status,
        toValue: status,
      });
    }

    // 담당자 변경
    if (assigneeId !== undefined) {
      if (assigneeId !== null) {
        const staff = await prisma.staff.findUnique({ where: { id: assigneeId } });
        if (!staff) {
          return NextResponse.json({ error: "존재하지 않는 담당자입니다." }, { status: 404 });
        }
      }
      updateData.assigneeId = assigneeId;
      activities.push({
        taskId: id,
        patientId: existing.patientId,
        staffId: staffId || undefined,
        action: "assignee_change",
        fromValue: existing.assigneeId || "미지정",
        toValue: assigneeId || "미지정",
      });
    }

    // 메모 저장
    if (note !== undefined) {
      updateData.note = note;
      activities.push({
        taskId: id,
        patientId: existing.patientId,
        staffId: staffId || undefined,
        action: "note_added",
        toValue: note ? note.substring(0, 100) : "",
      });
    }

    // 사유 저장 (보류/제외/완료)
    if (reason !== undefined) {
      updateData.reason = reason;
    }

    // 다음 확인일 설정
    if (nextFollowUpAt !== undefined) {
      updateData.nextFollowUpAt = nextFollowUpAt ? new Date(nextFollowUpAt) : null;
      activities.push({
        taskId: id,
        patientId: existing.patientId,
        staffId: staffId || undefined,
        action: "followup_set",
        toValue: nextFollowUpAt || "해제",
      });
    }

    const updated = await prisma.workflowTask.update({
      where: { id },
      data: updateData,
      include: {
        patient: { include: { identity: true } },
        assignee: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { staff: true },
        },
      },
    });

    // 활동 로그 일괄 기록
    if (activities.length > 0) {
      await prisma.activityLog.createMany({ data: activities });
    }

    onDashboardDataChanged();

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "업무를 수정할 수 없습니다." }, { status: 500 });
  }
}
