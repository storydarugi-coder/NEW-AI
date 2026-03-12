import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, hasCapability } from "@/lib/auth";
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

    if (!["FAILED", "RETRY_NEEDED"].includes(msg.sendStatus)) {
      return NextResponse.json({ error: "재시도 가능한 상태가 아닙니다." }, { status: 400 });
    }

    if (msg.sendAttemptCount >= 3) {
      return NextResponse.json({ error: "최대 재시도 횟수(3회)를 초과했습니다." }, { status: 400 });
    }

    // 상태 리셋 후 재발송
    await prisma.outboundMessage.update({
      where: { id },
      data: { sendStatus: "PENDING", failureReason: null },
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
