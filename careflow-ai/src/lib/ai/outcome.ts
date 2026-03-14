/**
 * 메시지 → 재내원 성과 추적 (Outcome Tracking)
 *
 * ── 귀속 규칙 (Attribution Rules) ──
 *
 * 1. 추적 대상: sendStatus === "SENT"인 메시지만 성과 추적.
 *    BLOCKED, FAILED, CANCELLED, PENDING 등은 제외.
 *
 * 2. 재내원 판정 기간 (Attribution Window):
 *    기본 30일. 메시지 발송일(sentAt) 이후 ~ windowDays 이내에
 *    동일 환자의 Visit 기록이 존재하면 "재내원 전환"으로 판정.
 *
 * 3. 다중 메시지 귀속 (Multi-Message Attribution):
 *    한 환자에게 여러 메시지가 발송된 경우 → "최종 접촉(Last-Touch)" 규칙 적용.
 *    재내원 직전에 가장 가까운 시점에 발송된 메시지 1건에만 전환을 귀속.
 *    (동일 방문을 여러 메시지에 중복 귀속하지 않음)
 *
 * 4. 방문 중복 귀속 방지:
 *    하나의 Visit은 최대 1건의 메시지에만 귀속.
 *    여러 메시지가 같은 Visit을 타겟하더라도 Last-Touch 1건만 인정.
 *
 * 5. 발송 당일 방문 제외:
 *    sentAt과 visitDate가 같은 날인 경우 → 메시지 효과로 보기 어려우므로 제외.
 *    최소 1일(다음날) 이상 경과한 방문만 귀속.
 *
 * 6. 생성 방식 식별:
 *    AuditLog(generate_message)의 generatedBy 필드 → "ai" | "template" | "fallback"
 *    AuditLog에 없으면 OutboundMessage.templateType을 fallback으로 사용.
 */

import { prisma } from "@/lib/prisma";
import { normalizeGenerationType } from "@/lib/ai/generation-type";

/** 기본 귀속 윈도우 (일) */
export const DEFAULT_ATTRIBUTION_WINDOW_DAYS = 30;

/** 발송 당일 방문 제외를 위한 최소 경과일 */
const MIN_DAYS_TO_REVISIT = 1;

export interface MessageOutcome {
  messageId: string;
  patientId: string;
  messageType: string;
  generatedBy: string | null;
  sentAt: Date;
  revisited: boolean;
  revisitDate: Date | null;
  daysToRevisit: number | null;
}

export interface OutcomeMetrics {
  period: { from: Date; to: Date };
  attributionWindowDays: number;
  totalSent: number;
  totalRevisited: number;
  conversionRate: number;
  byMessageType: Record<string, { sent: number; revisited: number; rate: number }>;
  byGeneratedBy: Record<string, { sent: number; revisited: number; rate: number }>;
  avgDaysToRevisit: number | null;
}

/**
 * 발송 메시지 → 재내원 여부를 매칭하여 개별 결과 목록 반환.
 * Last-Touch 귀속 + 방문 중복 방지 적용.
 */
export async function collectMessageOutcomes(
  from: Date,
  to: Date,
  revisitWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS
): Promise<MessageOutcome[]> {
  // SENT 상태만 대상
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
    orderBy: { sentAt: "desc" }, // Last-Touch 우선을 위해 최신순
  });

  if (sentMessages.length === 0) return [];

  const patientIds = [...new Set(sentMessages.map((m) => m.patientId))];

  // 발송 기간 + 귀속 윈도우까지의 방문 조회
  const windowEnd = new Date(to.getTime() + revisitWindowDays * 24 * 60 * 60 * 1000);
  const visits = await prisma.visit.findMany({
    where: {
      patientId: { in: patientIds },
      visitDate: { gte: from, lte: windowEnd },
    },
    select: { id: true, patientId: true, visitDate: true },
    orderBy: { visitDate: "asc" },
  });

  // 환자별 방문 인덱싱
  const visitsByPatient = new Map<string, { id: string; date: Date }[]>();
  for (const v of visits) {
    const list = visitsByPatient.get(v.patientId) || [];
    list.push({ id: v.id, date: v.visitDate });
    visitsByPatient.set(v.patientId, list);
  }

  // 생성 방식 정보 (AuditLog)
  const auditLogs = await prisma.auditLog.findMany({
    where: {
      action: "generate_message",
      entityType: "patient",
      entityId: { in: patientIds },
      createdAt: { gte: new Date(from.getTime() - 7 * 24 * 60 * 60 * 1000), lte: to },
    },
    select: { entityId: true, detail: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const generatedByPatient = new Map<string, string>();
  for (const log of auditLogs) {
    if (generatedByPatient.has(log.entityId)) continue; // 최신 것만
    try {
      const detail = JSON.parse(log.detail || "{}");
      if (detail.generatedBy) {
        generatedByPatient.set(log.entityId, detail.generatedBy);
      }
    } catch { /* skip */ }
  }

  // ── Last-Touch 귀속 + 방문 중복 방지 ──
  // 이미 귀속된 Visit ID 추적
  const claimedVisitIds = new Set<string>();
  // sentMessages는 sentAt desc 정렬 → 최신 메시지부터 처리
  const outcomes: MessageOutcome[] = [];

  for (const msg of sentMessages) {
    const sentDate = msg.sentAt!;
    const patientVisits = visitsByPatient.get(msg.patientId) || [];
    const windowLimit = new Date(sentDate.getTime() + revisitWindowDays * 24 * 60 * 60 * 1000);
    const minDate = new Date(sentDate.getTime() + MIN_DAYS_TO_REVISIT * 24 * 60 * 60 * 1000);

    // 발송일 +1일 ~ windowLimit 사이, 아직 귀속되지 않은 첫 방문
    const revisitEntry = patientVisits.find(
      (v) => v.date >= minDate && v.date <= windowLimit && !claimedVisitIds.has(v.id)
    );

    if (revisitEntry) {
      claimedVisitIds.add(revisitEntry.id);
    }

    const daysToRevisit = revisitEntry
      ? Math.floor((revisitEntry.date.getTime() - sentDate.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    outcomes.push({
      messageId: msg.id,
      patientId: msg.patientId,
      messageType: msg.messageType,
      generatedBy: generatedByPatient.get(msg.patientId) || msg.templateType || null,
      sentAt: sentDate,
      revisited: !!revisitEntry,
      revisitDate: revisitEntry?.date || null,
      daysToRevisit,
    });
  }

  return outcomes;
}

/**
 * 집계된 성과 메트릭
 */
export async function collectOutcomeMetrics(
  from: Date,
  to: Date,
  revisitWindowDays = DEFAULT_ATTRIBUTION_WINDOW_DAYS
): Promise<OutcomeMetrics> {
  const outcomes = await collectMessageOutcomes(from, to, revisitWindowDays);

  const totalSent = outcomes.length;
  const totalRevisited = outcomes.filter((o) => o.revisited).length;

  const byMessageType: Record<string, { sent: number; revisited: number }> = {};
  const byGeneratedBy: Record<string, { sent: number; revisited: number }> = {};
  const revisitDays: number[] = [];

  for (const o of outcomes) {
    // byMessageType
    if (!byMessageType[o.messageType]) byMessageType[o.messageType] = { sent: 0, revisited: 0 };
    byMessageType[o.messageType].sent++;
    if (o.revisited) byMessageType[o.messageType].revisited++;

    // byGeneratedBy — 정규화된 generationType 기준으로 집계
    const genKey = normalizeGenerationType(o.generatedBy);
    if (!byGeneratedBy[genKey]) byGeneratedBy[genKey] = { sent: 0, revisited: 0 };
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
    attributionWindowDays: revisitWindowDays,
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
