import { NextRequest, NextResponse } from "next/server";
import { hasCapability } from "@/lib/auth";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { executeOutboundSend } from "@/lib/messaging/send";

/**
 * 메시지 발송 실행 API
 * POST /api/outbound/:id/send
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

    const result = await executeOutboundSend({
      outboundMessageId: id,
      sentBy: user.name,
    });

    return NextResponse.json({
      success: result.success,
      failReason: result.failReason,
    });
  } catch (error) {
    console.error("Send error:", error);
    return NextResponse.json({ error: "발송 처리 실패" }, { status: 500 });
  }
}
