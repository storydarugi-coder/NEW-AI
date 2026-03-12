/**
 * 메시지 발송 오케스트레이터
 *
 * 발송 전 안전장치:
 * 1. 수신 거부(doNotContact) 확인
 * 2. 중복 발송 방지 (같은 유형 7일 이내)
 * 3. 연락처 유무 확인
 * 4. Provider 호출 + 결과 기록
 */

import { prisma } from "@/lib/prisma";
import { getMessageProvider } from "@/lib/messaging/provider";

const DUPLICATE_WINDOW_DAYS = 7;

interface SendContext {
  outboundMessageId: string;
  sentBy: string;
}

interface SendCheckResult {
  canSend: boolean;
  reason?: string;
  blockType?: "DO_NOT_CONTACT" | "DUPLICATE" | "NO_PHONE" | "NOT_APPROVED";
}

/**
 * 발송 전 안전 체크
 */
export async function checkBeforeSend(
  outboundMessageId: string
): Promise<SendCheckResult> {
  const msg = await prisma.outboundMessage.findUnique({
    where: { id: outboundMessageId },
    include: {
      patient: { include: { identity: true } },
    },
  });

  if (!msg) return { canSend: false, reason: "메시지를 찾을 수 없습니다." };

  // 1. 승인 확인
  if (msg.approvalStatus !== "APPROVED") {
    return {
      canSend: false,
      reason: "승인되지 않은 메시지입니다.",
      blockType: "NOT_APPROVED",
    };
  }

  // 2. 수신 거부 확인
  if (msg.patient.doNotContact) {
    return {
      canSend: false,
      reason: `수신 거부 환자: ${msg.patient.doNotContactReason || "수신 거부 설정됨"}`,
      blockType: "DO_NOT_CONTACT",
    };
  }

  // 3. 연락처 확인
  if (!msg.patient.identity?.phone) {
    return {
      canSend: false,
      reason: "환자 연락처 정보가 없습니다.",
      blockType: "NO_PHONE",
    };
  }

  // 4. 중복 발송 체크 (같은 환자 + 같은 messageType + 7일 이내)
  const windowStart = new Date();
  windowStart.setDate(windowStart.getDate() - DUPLICATE_WINDOW_DAYS);

  const recentSent = await prisma.outboundMessage.findFirst({
    where: {
      patientId: msg.patientId,
      messageType: msg.messageType,
      sendStatus: "SENT",
      sentAt: { gte: windowStart },
      id: { not: msg.id },
    },
  });

  if (recentSent) {
    return {
      canSend: false,
      reason: `최근 ${DUPLICATE_WINDOW_DAYS}일 내 동일 유형 메시지 발송 이력 있음 (${recentSent.sentAt?.toLocaleDateString("ko-KR")})`,
      blockType: "DUPLICATE",
    };
  }

  return { canSend: true };
}

/**
 * 실제 발송 실행
 */
export async function executeOutboundSend(
  ctx: SendContext
): Promise<{ success: boolean; failReason?: string }> {
  const msg = await prisma.outboundMessage.findUnique({
    where: { id: ctx.outboundMessageId },
    include: {
      patient: { include: { identity: true } },
    },
  });

  if (!msg) return { success: false, failReason: "메시지를 찾을 수 없습니다." };

  // 안전 체크
  const check = await checkBeforeSend(ctx.outboundMessageId);
  if (!check.canSend) {
    const blockData: Record<string, unknown> = {
      sendStatus: "BLOCKED",
      failureReason: check.reason,
      failedAt: new Date(),
    };
    if (check.blockType === "DO_NOT_CONTACT") {
      blockData.doNotContactBlocked = true;
    }
    if (check.blockType === "DUPLICATE") {
      blockData.duplicateBlocked = true;
      blockData.duplicateReason = check.reason;
    }
    await prisma.outboundMessage.update({
      where: { id: ctx.outboundMessageId },
      data: blockData,
    });
    return { success: false, failReason: check.reason };
  }

  // 발송 시도
  const provider = getMessageProvider();
  const content = msg.finalMessage || msg.draftMessage;
  const phone = msg.patient.identity!.phone;
  const name = msg.patient.identity?.name || msg.patient.chartNumber;

  await prisma.outboundMessage.update({
    where: { id: ctx.outboundMessageId },
    data: {
      sendStatus: "SENDING",
      sendAttemptCount: { increment: 1 },
      provider: provider.name,
      sentBy: ctx.sentBy,
    },
  });

  try {
    const result = await provider.send({
      recipientPhone: phone,
      recipientName: name,
      content,
    });

    if (result.success) {
      await prisma.outboundMessage.update({
        where: { id: ctx.outboundMessageId },
        data: {
          sendStatus: "SENT",
          sentAt: new Date(),
          externalId: result.externalId,
        },
      });

      // 감사 로그
      await prisma.auditLog.create({
        data: {
          action: "message_sent",
          entityType: "outbound_message",
          entityId: ctx.outboundMessageId,
          userId: ctx.sentBy,
          detail: JSON.stringify({
            provider: provider.name,
            externalId: result.externalId,
            messageType: msg.messageType,
          }),
        },
      });

      return { success: true };
    } else {
      await prisma.outboundMessage.update({
        where: { id: ctx.outboundMessageId },
        data: {
          sendStatus: msg.sendAttemptCount >= 2 ? "FAILED" : "RETRY_NEEDED",
          failedAt: new Date(),
          failureReason: result.failReason,
        },
      });
      return { success: false, failReason: result.failReason };
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    await prisma.outboundMessage.update({
      where: { id: ctx.outboundMessageId },
      data: {
        sendStatus: "FAILED",
        failedAt: new Date(),
        failureReason: `Provider 오류: ${errMsg}`,
      },
    });
    return { success: false, failReason: errMsg };
  }
}
