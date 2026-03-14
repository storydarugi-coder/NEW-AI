import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { VALID_TASK_STATUSES, VALID_ACTION_TYPES } from "@/types";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";
import { requireSession, requireProductArea, guardTenantAccess } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

// GET: 업무 목록 조회 (필터링, 정렬)
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const actionType = searchParams.get("actionType");
    const assigneeId = searchParams.get("assigneeId");
    const dueSoon = searchParams.get("dueSoon"); // "today" | "week"

    const where: Record<string, unknown> = {};

    // 테넌트 스코프: patient.tenantId 기준 필터링
    const scope = getTenantScope(session);
    if (scope.tenantId) {
      where.patient = { tenantId: scope.tenantId };
    }

    if (status && VALID_TASK_STATUSES.includes(status as typeof VALID_TASK_STATUSES[number])) {
      where.status = status;
    }
    if (actionType && VALID_ACTION_TYPES.includes(actionType as typeof VALID_ACTION_TYPES[number])) {
      where.actionType = actionType;
    }
    if (assigneeId) {
      where.assigneeId = assigneeId;
    }

    if (dueSoon === "today") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      where.nextFollowUpAt = { gte: todayStart, lte: todayEnd };
    } else if (dueSoon === "week") {
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() + 7);
      weekEnd.setHours(23, 59, 59, 999);
      where.nextFollowUpAt = { gte: now, lte: weekEnd };
    }

    const tasks = await prisma.workflowTask.findMany({
      where,
      include: {
        patient: {
          include: { identity: true },
        },
        assignee: true,
        activities: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
      orderBy: [
        { status: "asc" },
        { createdAt: "desc" },
      ],
    });

    return NextResponse.json(tasks);
  } catch {
    return NextResponse.json({ error: "업무 목록을 불러올 수 없습니다." }, { status: 500 });
  }
}

// POST: 새 업무 생성
export async function POST(request: NextRequest) {
  try {
    const { session: sess, error: authErr } = await requireSession();
    if (authErr) return authErr;
    const aErr = requireProductArea(sess, "hospital");
    if (aErr) return aErr;
    const body = await request.json();
    const { patientId, actionType, assigneeId, note, nextFollowUpAt } = body;

    if (!patientId) {
      return NextResponse.json({ error: "환자 ID가 필요합니다." }, { status: 400 });
    }
    if (!actionType || !VALID_ACTION_TYPES.includes(actionType)) {
      return NextResponse.json({ error: "유효하지 않은 액션 유형입니다." }, { status: 400 });
    }

    // 환자 존재 확인 + 테넌트 접근 검증
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: "존재하지 않는 환자입니다." }, { status: 404 });
    }
    const tenantError = guardTenantAccess(sess, patient);
    if (tenantError) return tenantError;

    // 담당자 존재 확인
    if (assigneeId) {
      const staff = await prisma.staff.findUnique({ where: { id: assigneeId } });
      if (!staff) {
        return NextResponse.json({ error: "존재하지 않는 담당자입니다." }, { status: 404 });
      }
    }

    const task = await prisma.workflowTask.create({
      data: {
        patientId,
        actionType,
        status: "unprocessed",
        assigneeId: assigneeId || null,
        note: note || null,
        nextFollowUpAt: nextFollowUpAt ? new Date(nextFollowUpAt) : null,
      },
      include: {
        patient: { include: { identity: true } },
        assignee: true,
      },
    });

    // 활동 로그 기록
    await prisma.activityLog.create({
      data: {
        taskId: task.id,
        patientId,
        staffId: assigneeId || null,
        action: "task_created",
        toValue: actionType,
        detail: JSON.stringify({ actionType }),
      },
    });

    onDashboardDataChanged();

    return NextResponse.json(task, { status: 201 });
  } catch {
    return NextResponse.json({ error: "업무를 생성할 수 없습니다." }, { status: 500 });
  }
}
