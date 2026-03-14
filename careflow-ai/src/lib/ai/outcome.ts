/**
 * 메시지 → 재내원 성과 추적 (Outcome Tracking)
 *
 * 발송된 메시지가 실제 재내원으로 이어졌는지 추적하는 구조.
 * - OutboundMessage(SENT) → 일정 기간 내 동일 환자 Visit 존재 여부
 * - 메시지 유형별, AI/template별 전환율 비교 가능
 *
 * 현재는 조회/집계 전용 (별도 테이블 없이 기존 모델 활용).
 * 향후 MessageOutcome 테이블로 확장 가능.
 */

import { prisma } from "@/lib/prisma";

export interface MessageOutcome {
  messageId: string;
  patientId: string;
  messageType: string;
  generatedBy: string | null; // ai, template, fallback
  sentAt: Date;
  // 재내원 결과
  revisited: boolean;
  revisitDate: Date | null;
  daysToRevisit: number | null;
}

export interface OutcomeMetrics {
  period: { from: Date; to: Date };
  /** 발송 → 재내원 전환율 전체 */
  totalSent: number;
  totalRevisited: number;
  conversionRate: number;
  /** 메시지 유형별 전환율 */
  byMessageType: Record<string, { sent: number; revisited: number; rate: number }>;
  /** 생성 방식별 전환율 (AI vs template vs fallback) */
  byGeneratedBy: Record<string, { sent: number; revisited: number; rate: number }>;
  /** 평균 재내원 소요일 */
  avgDaysToRevisit: number | null;
}

/**
 * 발송 메시지 → 재내원 여부를 매칭하여 개별 결과 목록 반환
 *
 * @param from 조회 시작일
 * @param to 조회 종료일
 * @param revisitWindowDays 재내원 판정 기간 (기본 30일)
 */
export async function collectMessageOutcomes(
  from: Date,
  to: Date,
  revisitWindowDays = 30
): Promise<MessageOutcome[]> {
  // 기간 내 발송 성공 메시지
  const sentMessages = await prisma.outboundMessage.findMany({
    where: {
      sendStatus: "SENT",
      sentAt: { gte: from, lte: to },
    },
    select: {
      id: true,
      patientId: true,
      messageType: true,
      sentAt: true,
      templateType: true,
    },
  });

  if (sentMessages.length === 0) return [];

  // 대상 환자 ID 목록
  const patientIds = [...new Set(sentMessages.map((m) => m.patientId))];

  // 발송일 이후 ~ revisitWindowDays 내 방문 조회
  const windowEnd = new Date(to.getTime() + revisitWindowDays * 24 * 60 * 60 * 1000);
  const visits = await prisma.visit.findMany({
    where: {
      patientId: { in: patientIds },
      visitDate: { gte: from, lte: windowEnd },
    },
    select: {
      patientId: true,
      visitDate: true,
    },
    orderBy: { visitDate: "asc" },
  });

  // 환자별 방문 목록 인덱싱
  const visitsByPatient = new Map<string, Date[]>();
  for (const v of visits) {
    const dates = visitsByPatient.get(v.patientId) || [];
    dates.push(v.visitDate);
    visitsByPatient.set(v.patientId, dates);
  }

  // 생성 방식 정보 (AuditLog에서 추출)
  const messageIds = sentMessages.map((m) => m.id);
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: "generate_message",
      entityType: "patient",
      entityId: { in: patientIds },
      createdAt: { gte: new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000), lte: to },
    },
    select: { entityId: true, detail: true },
  });

  // 환자별 최신 생성 방식
  const generatedByPatient = new Map<string, string>();
  for (const log of auditLogs) {
    try {
      const detail = JSON.parse(log.detail || "{}");
      if (detail.generatedBy) {
        generatedByPatient.set(log.entityId, detail.generatedBy);
      }
    } catch { /* skip */ }
  }

  // 매칭
  return sentMessages.map((msg) => {
    const sentDate = msg.sentAt!;
    const patientVisits = visitsByPatient.get(msg.patientId) || [];
    const windowLimit = new Date(sentDate.getTime() + revisitWindowDays * 24 * 60 * 60 * 1000);

    // 발송 이후 방문 중 첫 번째
    const revisit = patientVisits.find(
      (vd) => vd > sentDate && vd <= windowLimit
    );

    const daysToRevisit = revisit
      ? Math.floor((revisit.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    return {
      messageId: msg.id,
      patientId: msg.patientId,
      messageType: msg.messageType,
      generatedBy: generatedByPatient.get(msg.patientId) || msg.templateType || null,
      sentAt: sentDate,
      revisited: !!revisit,
      revisitDate: revisit || null,
      daysToRevisit,
    };
  });
}

/**
 * 집계된 성과 메트릭 반환
 */
export async function collectOutcomeMetrics(
  from: Date,
  to: Date,
  revisitWindowDays = 30
): Promise<OutcomeMetrics> {
  const outcomes = await collectMessageOutcomes(from, to, revisitWindowDays);

  const totalSent = outcomes.length;
  const totalRevisited = outcomes.filter((o) => o.revisited).length;

  // 메시지 유형별
  const byMessageType: Record<string, { sent: number; revisited: number }> = {};
  // 생성 방식별
  const byGeneratedBy: Record<string, { sent: number; revisited: number }> = {};

  const revisitDays: number[] = [];

  for (const o of outcomes) {
    // byMessageType
    if (!byMessageType[o.messageType]) {
      byMessageType[o.messageType] = { sent: 0, revisited: 0 };
    }
    byMessageType[o.messageType].sent++;
    if (o.revisited) byMessageType[o.messageType].revisited++;

    // byGeneratedBy
    const genKey = o.generatedBy || "unknown";
    if (!byGeneratedBy[genKey]) {
      byGeneratedBy[genKey] = { sent: 0, revisited: 0 };
    }
    byGeneratedBy[genKey].sent++;
    if (o.revisited) byGeneratedBy[genKey].revisited++;

    if (o.daysToRevisit != null) revisitDays.push(o.daysToRevisit);
  }

  const withRate = (map: Record<string, { sent: number; revisited: number }>) => {
    const result: Record<string, { sent: number; revisited: number; rate: number }> = {};
    for (const [k, v] of Object.entries(map)) {
      result[k] = { ...v, rate: v.sent > 0 ? Math.round((v.revisited / v.sent) * 100) : 0 };
    }
    return result;
  };

  return {
    period: { from, to },
    totalSent,
    totalRevisited,
    conversionRate: totalSent > 0 ? Math.round((totalRevisited / totalSent) * 100) : 0,
    byMessageType: withRate(byMessageType),
    byGeneratedBy: withRate(byGeneratedBy),
    avgDaysToRevisit: revisitDays.length > 0
      ? Math.round(revisitDays.reduce((a, b) => a + b, 0) / revisitDays.length)
      : null,
  };
}
