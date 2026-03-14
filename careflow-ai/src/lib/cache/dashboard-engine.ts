/**
 * 대시보드 엔진 결과 서버 사이드 캐시
 *
 * 환자 전체 조회 + 규칙 엔진 실행은 가장 무거운 연산입니다.
 * 이 모듈은 결과를 메모리에 TTL 기반으로 캐시하여
 * 동일 시간대 반복 요청 시 DB/엔진 재실행을 방지합니다.
 *
 * - TTL: 30초 (운영 데이터 신선도 유지)
 * - 캐시 miss 시에만 DB 조회 + 엔진 실행
 * - 서버 프로세스 단위 (serverless에서는 cold start마다 리셋)
 */

import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";

const CACHE_TTL_MS = 30_000; // 30초

interface ScoreFactor {
  label: string;
  score: number;
  reason: string;
}

interface PriorityPatientItem {
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  topPriority: number;
  priorityScore: number;
  scoreFactors: ScoreFactor[];
  lastVisitDate: string | null;
  detections: {
    ruleType: string;
    subType: string;
    priority: number;
    reason: string;
  }[];
}

interface WeeklyChange {
  change: number;
  label: string;
}

export interface DashboardEngineResult {
  stats: {
    todayActionCount: number;
    treatmentDropoutCount: number;
    recallDueCount: number;
    messageSuggestionCount: number;
  };
  weeklyChanges: {
    todayAction: WeeklyChange;
    treatmentDropout: WeeklyChange;
    recallDue: WeeklyChange;
    messageSuggestion: WeeklyChange;
  };
  urgentPatients: PriorityPatientItem[];
  priorityPatients: PriorityPatientItem[];
}

let cachedResult: DashboardEngineResult | null = null;
let cachedAt = 0;
let pendingPromise: Promise<DashboardEngineResult | null> | null = null;

/**
 * 캐시된 대시보드 엔진 결과를 반환합니다.
 * TTL 내라면 캐시 히트, 아니면 DB + 엔진을 실행합니다.
 * 동시 요청 시 하나의 Promise만 실행됩니다 (thundering herd 방지).
 */
export async function getCachedDashboardEngine(): Promise<DashboardEngineResult | null> {
  const now = Date.now();

  // 캐시 히트
  if (cachedResult && now - cachedAt < CACHE_TTL_MS) {
    return cachedResult;
  }

  // 이미 다른 요청이 실행 중이면 그 결과를 대기
  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = computeDashboardEngine();

  try {
    const result = await pendingPromise;
    cachedResult = result;
    cachedAt = Date.now();
    return result;
  } finally {
    pendingPromise = null;
  }
}

async function computeDashboardEngine(): Promise<DashboardEngineResult | null> {
  const ruleConfigs = await prisma.ruleConfig.findMany();
  const engineConfig = buildEngineConfig(ruleConfigs);

  const patients = await prisma.patient.findMany({
    select: {
      id: true,
      chartNumber: true,
      isVip: true,
      identity: { select: { name: true } },
      visits: {
        select: {
          id: true,
          visitDate: true,
          procedures: { select: { code: true, name: true, tooth: true } },
          diagnoses: { select: { code: true, name: true, tooth: true } },
        },
        orderBy: { visitDate: "desc" },
      },
    },
  });

  if (patients.length === 0) {
    return null;
  }

  const patientMap = new Map(patients.map((p) => [p.id, p]));
  const detectionMap = evaluateAllPatients(patients, engineConfig);

  let treatmentDropoutCount = 0;
  let recallDueCount = 0;
  let messageSuggestionCount = 0;
  const priorityPatients: PriorityPatientItem[] = [];

  for (const [patientId, detections] of detectionMap.entries()) {
    const patient = patientMap.get(patientId);
    if (!patient) continue;

    for (const d of detections) {
      if (d.ruleType === "treatment_dropout") treatmentDropoutCount++;
      if (d.ruleType === "scaling_recall" || d.ruleType === "implant_followup")
        recallDueCount++;
      messageSuggestionCount++;
    }

    const lastVisitDate = patient.visits[0]?.visitDate || null;
    const { totalScore, factors } = calculatePriorityScore(
      detections,
      lastVisitDate,
      patient.isVip,
      patient.visits.length
    );

    priorityPatients.push({
      patientId,
      patientName: patient.identity?.name || patient.chartNumber,
      chartNumber: patient.chartNumber,
      isVip: patient.isVip,
      topPriority: Math.min(...detections.map((d) => d.priority)),
      priorityScore: totalScore,
      scoreFactors: factors,
      lastVisitDate: lastVisitDate?.toISOString() || null,
      detections: detections.map((d) => ({
        ruleType: d.ruleType,
        subType: d.subType,
        priority: d.priority,
        reason: d.reason,
      })),
    });
  }

  priorityPatients.sort((a, b) => b.priorityScore - a.priorityScore);

  const weeklyChanges = {
    todayAction: calculateWeeklyChange(detectionMap.size),
    treatmentDropout: calculateWeeklyChange(treatmentDropoutCount),
    recallDue: calculateWeeklyChange(recallDueCount),
    messageSuggestion: calculateWeeklyChange(messageSuggestionCount),
  };

  const urgentPatients = priorityPatients
    .filter((p) => p.topPriority <= 2)
    .slice(0, 5);

  return {
    stats: {
      todayActionCount: detectionMap.size,
      treatmentDropoutCount,
      recallDueCount,
      messageSuggestionCount,
    },
    weeklyChanges,
    urgentPatients,
    priorityPatients,
  };
}
