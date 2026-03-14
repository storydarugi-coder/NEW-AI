import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCapability } from "@/lib/auth";
import { requireSession, requireProductArea, guardTenantAccessViaPatient } from "@/lib/api-auth";
import { executeOutboundSend } from "@/lib/messaging/send";

/**
 * 메시지 재시도 API
 * POST /api/outbound/:id/retry
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { session: user, error: authErr } = await requireSession();
    if (authErr) return authErr;
    const areaError = requireProductArea(user, "hospital");
    if (areaError) return areaError;
    if (!hasCapability(user.role, "send_message")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id } = await params;

    const msg = await prisma.outboundMessage.findUnique({
      where: { id },
      include: { patient: { select: { tenantId: true } } },
    });
    if (!msg) {
      return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    }
    const tenantError = guardTenantAccessViaPatient(user, msg.patient);
    if (tenantError) return tenantError;

    const isBlocked = msg.sendStatus === "BLOCKED";
    if (!isBlocked && !["FAILED", "RETRY_NEEDED"].includes(msg.sendStatus)) {
      return NextResponse.json({ error: "재시도 가능한 상태가 아닙니다." }, { status: 400 });
    }

    // 수신거부 차단은 재시도 불가
    if (isBlocked && msg.doNotContactBlocked) {
      return NextResponse.json({ error: "수신거부 환자는 재시도할 수 없습니다." }, { status: 400 });
    }

    if (msg.sendAttemptCount >= 3) {
      return NextResponse.json({ error: "최대 재시도 횟수(3회)를 초과했습니다." }, { status: 400 });
    }

    const previousStatus = msg.sendStatus;
    const blockReason = msg.doNotContactBlocked
      ? "DO_NOT_CONTACT"
      : msg.duplicateBlocked
        ? "DUPLICATE"
        : msg.failureReason || "UNKNOWN";

    // 상태 리셋 후 재발송
    await prisma.outboundMessage.update({
      where: { id },
      data: {
        sendStatus: "PENDING",
        failureReason: null,
        duplicateBlocked: false,
        duplicateReason: null,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "retry_blocked_message",
        entityType: "outbound_message",
        entityId: id,
        userId: user.id,
        detail: JSON.stringify({
          user: user.name,
          messageId: id,
          patientId: msg.patientId,
          blockReason,
          beforeState: previousStatus,
          afterState: "PENDING",
        }),
      },
    });

    const result = await executeOutboundSend({
      outboundMessageId: id,
      sentBy: user.name,
    });

    return NextResponse.json({
      success: result.success,
      failReason: result.failReason,
      attemptCount: msg.sendAttemptCount + 1,
    });
  } catch (error) {
    console.error("Retry error:", error);
    return NextResponse.json({ error: "재시도 처리 실패" }, { status: 500 });
  }
}
