/**
 * AI 메시지 생성 운영 메트릭 수집
 *
 * 메시지 생성 및 발송에 관한 운영 지표를 집계합니다.
 * - generationType 비율 (AI / 템플릿 / fallback)
 * - fallback 전환율
 * - 실패 사유 분포
 * - 평균 메시지 길이
 * - 발송 성공률
 * - 메시지 유형별 메트릭
 */

import { prisma } from "@/lib/prisma";

export interface GenerationMetrics {
  /** 기간 내 총 생성 건수 */
  totalGenerated: number;
  /** generationType별 건수 */
  byType: {
    ai: number;
    template: number;
    fallback: number;
  };
  /** fallback 전환율 (%) */
  fallbackRate: number;
}

export interface SendMetrics {
  /** 총 발송 시도 건수 */
  totalAttempted: number;
  /** 성공 건수 */
  sent: number;
  /** 실패 건수 */
  failed: number;
  /** 차단 건수 */
  blocked: number;
  /** 발송 성공률 (%) */
  successRate: number;
  /** 차단 사유 분포 */
  blockReasons: Record<string, number>;
}

export interface MessageLengthMetrics {
  /** 평균 글자 수 */
  avgShort: number;
  avgStandard: number;
  avgWarm: number;
}

export interface MessageTypeMetrics {
  /** 메시지 유형별 건수 */
  byMessageType: Record<string, {
    total: number;
    sent: number;
    failed: number;
    blocked: number;
  }>;
}

export interface OperationsMetrics {
  period: { from: Date; to: Date };
  generation: GenerationMetrics;
  send: SendMetrics;
  length: MessageLengthMetrics;
  byType: MessageTypeMetrics;
}

/**
 * 지정 기간의 운영 메트릭을 집계
 */
export async function collectOperationsMetrics(
  from: Date,
  to: Date
): Promise<OperationsMetrics> {
  const [generation, send, length, byType] = await Promise.all([
    collectGenerationMetrics(from, to),
    collectSendMetrics(from, to),
    collectLengthMetrics(from, to),
    collectMessageTypeMetrics(from, to),
  ]);

  return { period: { from, to }, generation, send, length, byType };
}

async function collectGenerationMetrics(
  from: Date,
  to: Date
): Promise<GenerationMetrics> {
  // AuditLog에서 generate_message 액션을 집계
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "generate_message",
      createdAt: { gte: from, lte: to },
    },
    select: { detail: true },
  });

  const counts = { ai: 0, template: 0, fallback: 0 };

  for (const log of logs) {
    try {
      const detail = JSON.parse(log.detail || "{}");
      const type = detail.generatedBy === "gemini" ? "ai" : (detail.generatedBy || "fallback");
      if (type in counts) {
        counts[type as keyof typeof counts]++;
      }
    } catch {
      counts.fallback++;
    }
  }

  const total = counts.ai + counts.template + counts.fallback;

  return {
    totalGenerated: total,
    byType: counts,
    fallbackRate: total > 0 ? Math.round((counts.fallback / total) * 100) : 0,
  };
}

async function collectSendMetrics(
  from: Date,
  to: Date
): Promise<SendMetrics> {
  const messages = await prisma.outboundMessage.findMany({
    where: {
      updatedAt: { gte: from, lte: to },
      sendStatus: { in: ["SENT", "FAILED", "BLOCKED"] },
    },
    select: {
      sendStatus: true,
      failureReason: true,
      doNotContactBlocked: true,
      duplicateBlocked: true,
    },
  });

  const sent = messages.filter((m) => m.sendStatus === "SENT").length;
  const failed = messages.filter((m) => m.sendStatus === "FAILED").length;
  const blocked = messages.filter((m) => m.sendStatus === "BLOCKED").length;
  const total = messages.length;

  // 차단 사유 분포
  const blockReasons: Record<string, number> = {};
  for (const m of messages) {
    if (m.sendStatus === "BLOCKED") {
      let reason = "기타";
      if (m.doNotContactBlocked) reason = "수신거부";
      else if (m.duplicateBlocked) reason = "중복/최근내원";
      blockReasons[reason] = (blockReasons[reason] || 0) + 1;
    }
  }

  return {
    totalAttempted: total,
    sent,
    failed,
    blocked,
    successRate: total > 0 ? Math.round((sent / total) * 100) : 0,
    blockReasons,
  };
}

async function collectLengthMetrics(
  from: Date,
  to: Date
): Promise<MessageLengthMetrics> {
  const drafts = await prisma.messageDraft.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      length: true,
      content: true,
    },
  });

  const byLength: Record<string, number[]> = {
    short: [],
    medium: [],
    long: [],
  };

  for (const d of drafts) {
    const len = d.length as string;
    if (len in byLength) {
      byLength[len].push(d.content.length);
    }
  }

  const avg = (arr: number[]) =>
    arr.length > 0 ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  return {
    avgShort: avg(byLength.short),
    avgStandard: avg(byLength.medium),
    avgWarm: avg(byLength.long),
  };
}

async function collectMessageTypeMetrics(
  from: Date,
  to: Date
): Promise<MessageTypeMetrics> {
  const messages = await prisma.outboundMessage.findMany({
    where: {
      createdAt: { gte: from, lte: to },
    },
    select: {
      messageType: true,
      sendStatus: true,
    },
  });

  const byMessageType: Record<string, { total: number; sent: number; failed: number; blocked: number }> = {};

  for (const m of messages) {
    const type = m.messageType || "UNKNOWN";
    if (!byMessageType[type]) {
      byMessageType[type] = { total: 0, sent: 0, failed: 0, blocked: 0 };
    }
    byMessageType[type].total++;
    if (m.sendStatus === "SENT") byMessageType[type].sent++;
    if (m.sendStatus === "FAILED") byMessageType[type].failed++;
    if (m.sendStatus === "BLOCKED") byMessageType[type].blocked++;
  }

  return { byMessageType };
}
