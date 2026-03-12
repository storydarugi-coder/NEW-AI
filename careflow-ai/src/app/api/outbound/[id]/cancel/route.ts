import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, hasCapability } from "@/lib/auth";

/**
 * 메시지 취소 API
 * POST /api/outbound/:id/cancel
 */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = verifySession(request.cookies.get("session")?.value);
    if (!user) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    if (!hasCapability(user.role, "send_message")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const { id } = await params;

    const msg = await prisma.outboundMessage.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    }

    if (msg.sendStatus === "SENT") {
      return NextResponse.json({ error: "이미 발송된 메시지는 취소할 수 없습니다." }, { status: 400 });
    }

    await prisma.outboundMessage.update({
      where: { id },
      data: {
        sendStatus: "CANCELLED",
        failureReason: `${user.name}에 의해 취소됨`,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "message_cancelled",
        entityType: "outbound_message",
        entityId: id,
        userId: user.id,
        detail: JSON.stringify({ cancelledBy: user.name }),
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Cancel error:", error);
    return NextResponse.json({ error: "취소 처리 실패" }, { status: 500 });
  }
}
