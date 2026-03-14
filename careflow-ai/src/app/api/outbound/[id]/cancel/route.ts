import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCapability } from "@/lib/auth";
import { requireSession, requireProductArea, guardTenantAccessViaPatient } from "@/lib/api-auth";

/**
 * 메시지 취소 API
 * POST /api/outbound/:id/cancel
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

    if (msg.sendStatus === "SENT") {
      return NextResponse.json({ error: "이미 발송된 메시지는 취소할 수 없습니다." }, { status: 400 });
    }

    const previousStatus = msg.sendStatus;
    const blockReason = msg.doNotContactBlocked
      ? "DO_NOT_CONTACT"
      : msg.duplicateBlocked
        ? "DUPLICATE"
        : msg.failureReason || "UNKNOWN";

    await prisma.outboundMessage.update({
      where: { id },
      data: {
        sendStatus: "CANCELLED",
        failureReason: `${user.name}에 의해 취소됨`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "exclude_blocked_message",
        entityType: "outbound_message",
        entityId: id,
        userId: user.id,
        detail: JSON.stringify({
          user: user.name,
          messageId: id,
          patientId: msg.patientId,
          blockReason,
          beforeState: previousStatus,
          afterState: "CANCELLED",
        }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "취소 처리 실패" }, { status: 500 });
  }
}
