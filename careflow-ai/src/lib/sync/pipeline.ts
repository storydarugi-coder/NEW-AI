/**
 * Sync Pipeline — 데이터 유입 흐름 추상화
 *
 * 모든 외부 데이터(CSV, EMR API, Seed 등)는 SyncJob을 통해 기록되어
 * "언제 어떤 데이터가 들어왔는지" 설명할 수 있다.
 *
 * CSV Import → SyncJob(CSV_IMPORT) + ImportBatch
 * EMR Pull   → SyncJob(EMR_PULL)   (향후)
 * Seed       → SyncJob(SEED)
 */

import { prisma } from "@/lib/prisma";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";

export type SyncType = "CSV_IMPORT" | "EMR_PULL" | "MANUAL_REPROCESS" | "SEED";
export type SourceSystem = "csv" | "mock-emr" | "api" | "seed";
export type SyncStatus =
  | "PENDING"
  | "RUNNING"
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED";

export interface CreateSyncJobInput {
  syncType: SyncType;
  sourceSystem: SourceSystem;
  triggeredBy: string;
  notes?: string;
  importBatchId?: string;
}

export interface SyncJobResult {
  totalRecords: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  duplicateCount: number;
  unclassifiedCount: number;
  errorSummary?: string;
}

/**
 * 새 SyncJob 생성 (RUNNING 상태)
 */
export async function startSyncJob(input: CreateSyncJobInput) {
  return prisma.syncJob.create({
    data: {
      syncType: input.syncType,
      sourceSystem: input.sourceSystem,
      status: "RUNNING",
      startedAt: new Date(),
      triggeredBy: input.triggeredBy,
      notes: input.notes,
      importBatchId: input.importBatchId,
    },
  });
}

/**
 * SyncJob 완료 처리
 */
export async function completeSyncJob(
  jobId: string,
  result: SyncJobResult
) {
  const status: SyncStatus =
    result.failedCount === 0
      ? "SUCCESS"
      : result.successCount === 0
        ? "FAILED"
        : "PARTIAL_SUCCESS";

  const job = await prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status,
      finishedAt: new Date(),
      totalRecords: result.totalRecords,
      successCount: result.successCount,
      failedCount: result.failedCount,
      skippedCount: result.skippedCount,
      duplicateCount: result.duplicateCount,
      unclassifiedCount: result.unclassifiedCount,
      errorSummary: result.errorSummary,
    },
  });

  onDashboardDataChanged();

  return job;
}

/**
 * SyncJob 실패 처리
 */
export async function failSyncJob(jobId: string, errorSummary: string) {
  return prisma.syncJob.update({
    where: { id: jobId },
    data: {
      status: "FAILED",
      finishedAt: new Date(),
      errorSummary,
    },
  });
}
