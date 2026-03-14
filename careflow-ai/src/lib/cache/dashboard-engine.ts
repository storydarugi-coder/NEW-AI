/**
 * 대시보드 엔진 결과 캐시 + Read Model
 *
 * 3계층 읽기 전략:
 *   1. 메모리 캐시 (TTL 30초, 가장 빠름)
 *   2. DB Read Model - DashboardSummary 테이블 (5분 이내면 유효)
 *   3. Live 계산 (DB 조회 + 규칙 엔진 실행, 가장 느림)
 *
 * 쓰기 전략 (이벤트 기반):
 *   - invalidateDashboardCache(): 메모리 캐시 즉시 무효화
 *   - refreshDashboardSummary(): DB Read Model 갱신 (비동기, fire-and-forget)
 *   - 주요 데이터 mutation 후 invalidate → refresh 호출
 *
 * Thundering herd 방지: 동시 요청 시 하나의 Promise만 실행
 */

import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";

// ── 타입 ──

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

// ── 메모리 캐시 ──

const MEMORY_TTL_MS = 30_000; // 30초
const READ_MODEL_MAX_AGE_MS = 5 * 60_000; // 5분

let cachedResult: DashboardEngineResult | null = null;
let cachedAt = 0;
let pendingPromise: Promise<DashboardEngineResult | null> | null = null;

// ── Public API ──

/**
 * 대시보드 엔진 결과를 3계층에서 읽습니다.
 * 메모리 → DB Read Model → Live 계산 순으로 시도합니다.
 */
export async function getCachedDashboardEngine(): Promise<DashboardEngineResult | null> {
  const now = Date.now();

  // Layer 1: 메모리 캐시
  if (cachedResult && now - cachedAt < MEMORY_TTL_MS) {
    return cachedResult;
  }

  // Thundering herd 방지
  if (pendingPromise) {
    return pendingPromise;
  }

  pendingPromise = loadWithFallback();

  try {
    const result = await pendingPromise;
    cachedResult = result;
    cachedAt = Date.now();
    return result;
  } finally {
    pendingPromise = null;
  }
}

/**
 * 메모리 캐시를 즉시 무효화합니다.
 * 다음 요청 시 DB Read Model 또는 Live 계산이 실행됩니다.
 */
export function invalidateDashboardCache(): void {
  cachedResult = null;
  cachedAt = 0;
}

/**
 * DB Read Model (DashboardSummary)을 갱신합니다.
 * 데이터 변경 후 fire-and-forget으로 호출합니다.
 * 실패해도 무시합니다 (다음 요청 시 live 계산으로 fallback).
 */
export async function refreshDashboardSummary(): Promise<void> {
  try {
    const result = await computeDashboardEngine();
    if (!result) return;

    await prisma.dashboardSummary.upsert({
      where: { id: "singleton" },
      create: {
        id: "singleton",
        statsJson: JSON.stringify(result.stats),
        patientsJson: JSON.stringify({
          weeklyChanges: result.weeklyChanges,
          urgentPatients: result.urgentPatients,
          priorityPatients: result.priorityPatients.slice(0, 25),
        }),
        computedAt: new Date(),
      },
      update: {
        statsJson: JSON.stringify(result.stats),
        patientsJson: JSON.stringify({
          weeklyChanges: result.weeklyChanges,
          urgentPatients: result.urgentPatients,
          priorityPatients: result.priorityPatients.slice(0, 25),
        }),
        computedAt: new Date(),
      },
    });

    // 메모리 캐시도 갱신
    cachedResult = result;
    cachedAt = Date.now();
  } catch (error) {
    console.error("[CareFlow] DashboardSummary refresh failed:", error);
  }
}

/**
 * 이벤트 기반 캐시 무효화 + 비동기 갱신
 * 데이터 mutation 후 호출하세요.
 */
export function onDashboardDataChanged(): void {
  invalidateDashboardCache();
  // fire-and-forget: 비동기로 read model 갱신
  refreshDashboardSummary().catch(() => {});
}

// ── 내부 함수 ──

async function loadWithFallback(): Promise<DashboardEngineResult | null> {
  // Layer 2: DB Read Model
  try {
    const summary = await prisma.dashboardSummary.findUnique({
      where: { id: "singleton" },
    });

    if (summary) {
      const age = Date.now() - summary.computedAt.getTime();
      if (age < READ_MODEL_MAX_AGE_MS) {
        const stats = JSON.parse(summary.statsJson);
        const patientsData = JSON.parse(summary.patientsJson);
        return {
          stats,
          weeklyChanges: patientsData.weeklyChanges,
          urgentPatients: patientsData.urgentPatients,
          priorityPatients: patientsData.priorityPatients,
        };
      }
    }
  } catch {
    // DashboardSummary 테이블이 없거나 파싱 실패 — fallthrough
  }

  // Layer 3: Live 계산
  const result = await computeDashboardEngine();

  // 계산 성공 시 read model도 비동기 갱신
  if (result) {
    refreshDashboardSummary().catch(() => {});
  }

  return result;
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
