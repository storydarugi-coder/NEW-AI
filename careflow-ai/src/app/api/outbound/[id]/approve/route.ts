import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, hasCapability } from "@/lib/auth";

/**
 * 메시지 승인/반려 API
 * POST /api/outbound/:id/approve
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
    const body = await request.json();
    const { action, finalMessage, memo, rejectedReason } = body as {
      action: "approve" | "reject";
      finalMessage?: string;
      memo?: string;
      rejectedReason?: string;
    };

    if (!action) {
      return NextResponse.json({ error: "action이 필요합니다." }, { status: 400 });
    }

    const msg = await prisma.outboundMessage.findUnique({ where: { id } });
    if (!msg) {
      return NextResponse.json({ error: "메시지를 찾을 수 없습니다." }, { status: 404 });
    }

    if (action === "approve") {
      await prisma.outboundMessage.update({
        where: { id },
        data: {
          approvalStatus: "APPROVED",
          approvedBy: user.name,
          approvedAt: new Date(),
          approvalMemo: memo || null,
          finalMessage: finalMessage || msg.draftMessage,
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "message_approved",
          entityType: "outbound_message",
          entityId: id,
          userId: user.id,
          detail: JSON.stringify({ approvedBy: user.name, messageType: msg.messageType }),
        },
      });

      return NextResponse.json({ success: true, status: "APPROVED" });
    }

    if (action === "reject") {
      await prisma.outboundMessage.update({
        where: { id },
        data: {
          approvalStatus: "REJECTED",
          rejectedReason: rejectedReason || "반려",
          approvalMemo: memo || null,
          sendStatus: "CANCELLED",
        },
      });

      return NextResponse.json({ success: true, status: "REJECTED" });
    }

    return NextResponse.json({ error: "잘못된 action" }, { status: 400 });
  } catch (error) {
    console.error("Approve error:", error);
    return NextResponse.json({ error: "승인 처리 실패" }, { status: 500 });
  }
}
