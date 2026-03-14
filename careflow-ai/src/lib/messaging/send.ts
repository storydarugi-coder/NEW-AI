/**
 * 메시지 발송 오케스트레이터
 *
 * 발송 전 안전장치:
 * 1. 승인 상태 확인 (APPROVED만 발송)
 * 2. 수신 거부(doNotContact) 확인
 * 3. 연락처 유무 확인
 * 4. 중복 발송 방지 (같은 유형 7일 이내)
 * 5. 최근 내원자 제외 (3일 이내 방문 환자)
 * 6. 발송 대기 중 메시지 중복 방지
 * 7. Provider 호출 + 결과 기록
 */

import { prisma } from "@/lib/prisma";
import { getMessageProvider } from "@/lib/messaging/provider";

const DUPLICATE_WINDOW_DAYS = 7;
/** 최근 내원 환자 발송 제외 기간 (일) */
const RECENT_VISIT_EXCLUDE_DAYS = 3;

interface SendContext {
  outboundMessageId: string;
  sentBy: string;
}

interface SendCheckResult {
  canSend: boolean;
  reason?: string;
  blockType?: "DO_NOT_CONTACT" | "DUPLICATE" | "NO_PHONE" | "NOT_APPROVED" | "RECENT_VISIT" | "HAS_APPOINTMENT";
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

  // 5. 최근 내원자 제외 (3일 이내 방문한 환자에게 리콜 메시지 불필요)
  const recentVisitCutoff = new Date();
  recentVisitCutoff.setDate(recentVisitCutoff.getDate() - RECENT_VISIT_EXCLUDE_DAYS);

  const recentVisit = await prisma.visit.findFirst({
    where: {
      patientId: msg.patientId,
      visitDate: { gte: recentVisitCutoff },
    },
    orderBy: { visitDate: "desc" },
  });

  if (recentVisit) {
    return {
      canSend: false,
      reason: `최근 ${RECENT_VISIT_EXCLUDE_DAYS}일 이내 내원 이력 있음 (${recentVisit.visitDate.toLocaleDateString("ko-KR")})`,
      blockType: "RECENT_VISIT",
    };
  }

  // 6. 예약 완료자 제외 (이미 APPROVED 상태의 대기 메시지가 있으면 중복 발송 방지)
  const pendingApproved = await prisma.outboundMessage.findFirst({
    where: {
      patientId: msg.patientId,
      sendStatus: { in: ["PENDING", "SCHEDULED", "SENDING"] },
      id: { not: msg.id },
    },
  });

  if (pendingApproved) {
    return {
      canSend: false,
      reason: "이미 발송 대기 중인 메시지가 있습니다.",
      blockType: "HAS_APPOINTMENT",
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
    if (check.blockType === "RECENT_VISIT" || check.blockType === "HAS_APPOINTMENT") {
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
