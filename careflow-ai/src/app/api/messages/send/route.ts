import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMessageProvider } from "@/lib/messaging/provider";
import { requireSession, requireProductArea, guardTenantAccessViaPatient } from "@/lib/api-auth";

/**
 * 메시지 발송 API
 * POST: 메시지 초안을 검토 후 발송 대기열에 추가하거나 즉시 발송
 */
export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "hospital");
    if (areaError) return areaError;
    const body = await request.json();
    const { messageId, action } = body as {
      messageId: string;
      action: "queue" | "send" | "cancel";
    };

    if (!messageId || !action) {
      return NextResponse.json(
        { error: "messageId와 action이 필요합니다." },
        { status: 400 }
      );
    }

    const message = await prisma.messageDraft.findUnique({
      where: { id: messageId },
      include: {
        patient: { include: { identity: true } },
      },
    });

    if (!message) {
      return NextResponse.json(
        { error: "메시지를 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    const tenantError = guardTenantAccessViaPatient(session, message.patient);
    if (tenantError) return tenantError;

    if (action === "cancel") {
      // 발송 대기 중인 건 취소
      await prisma.messageDraft.update({
        where: { id: messageId },
        data: { status: "draft" },
      });

      const delivery = await prisma.messageDelivery.findFirst({
        where: { messageId, status: "queued" },
      });
      if (delivery) {
        await prisma.messageDelivery.update({
          where: { id: delivery.id },
          data: { status: "cancelled" },
        });
      }

      return NextResponse.json({ success: true, status: "cancelled" });
    }

    if (action === "queue") {
      // 발송 대기열에 추가
      await prisma.messageDraft.update({
        where: { id: messageId },
        data: { status: "queued" },
      });

      const delivery = await prisma.messageDelivery.create({
        data: {
          messageId,
          provider: process.env.MESSAGE_PROVIDER || "mock",
          status: "queued",
        },
      });

      await prisma.auditLog.create({
        data: {
          action: "queue_message",
          entityType: "message",
          entityId: messageId,
          detail: JSON.stringify({ provider: delivery.provider }),
        },
      });

      return NextResponse.json({ success: true, status: "queued", deliveryId: delivery.id });
    }

    if (action === "send") {
      // 즉시 발송 시도
      const phone = message.patient.identity?.phone;
      const name = message.patient.identity?.name || message.patient.chartNumber;

      if (!phone) {
        return NextResponse.json(
          { error: "환자 연락처 정보가 없습니다." },
          { status: 400 }
        );
      }

      const provider = getMessageProvider();

      const delivery = await prisma.messageDelivery.create({
        data: {
          messageId,
          provider: provider.name,
          status: "sending",
        },
      });

      const result = await provider.send({
        recipientPhone: phone,
        recipientName: name,
        content: message.content,
      });

      await prisma.messageDelivery.update({
        where: { id: delivery.id },
        data: {
          status: result.success ? "sent" : "failed",
          sentAt: result.success ? new Date() : null,
          failReason: result.failReason || null,
          externalId: result.externalId || null,
        },
      });

      await prisma.messageDraft.update({
        where: { id: messageId },
        data: { status: result.success ? "sent" : "failed" },
      });

      await prisma.auditLog.create({
        data: {
          action: "send_message",
          entityType: "message",
          entityId: messageId,
          detail: JSON.stringify({
            provider: provider.name,
            success: result.success,
            externalId: result.externalId,
          }),
        },
      });

      return NextResponse.json({
        success: result.success,
        status: result.success ? "sent" : "failed",
        failReason: result.failReason,
      });
    }

    return NextResponse.json({ error: "잘못된 action입니다." }, { status: 400 });
  } catch (error) {
    console.error("Message send error:", error);
    return NextResponse.json(
      { error: "메시지 발송 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
