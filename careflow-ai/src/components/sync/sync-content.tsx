"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  ArrowRight,
  RotateCcw,
  Database,
  FileSpreadsheet,
  Server,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface SyncJob {
  id: string;
  syncType: string;
  sourceSystem: string;
  status: string;
  startedAt: string;
  finishedAt: string | null;
  totalRecords: number;
  successCount: number;
  failedCount: number;
  skippedCount: number;
  duplicateCount: number;
  unclassifiedCount: number;
  errorSummary: string | null;
  triggeredBy: string;
  notes: string | null;
  importBatchId: string | null;
}

interface SyncSummary {
  total: number;
  success: number;
  partialSuccess: number;
  failed: number;
  running: number;
  lastSync: string | null;
  lastSyncStatus: string | null;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: typeof CheckCircle2; color: string; bg: string }
> = {
  SUCCESS: {
    label: "성공",
    icon: CheckCircle2,
    color: "text-green-600",
    bg: "bg-green-50",
  },
  PARTIAL_SUCCESS: {
    label: "부분 성공",
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  FAILED: {
    label: "실패",
    icon: XCircle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  RUNNING: {
    label: "실행 중",
    icon: Loader2,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  PENDING: {
    label: "대기",
    icon: Clock,
    color: "text-gray-500",
    bg: "bg-gray-50",
  },
};

const SYNC_TYPE_LABELS: Record<string, string> = {
  CSV_IMPORT: "CSV 가져오기",
  EMR_PULL: "EMR 동기화",
  MANUAL_REPROCESS: "수동 재처리",
  SEED: "시드 데이터",
};

const SOURCE_ICONS: Record<string, typeof Database> = {
  csv: FileSpreadsheet,
  "mock-emr": Server,
  api: Server,
  seed: Database,
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "방금 전";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

export function SyncContent() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<SyncJob[]>([]);
  const [summary, setSummary] = useState<SyncSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [reprocessing, setReprocessing] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const res = await fetch("/api/sync");
      if (res.ok) {
        const data = await res.json();
        setJobs(data.jobs);
        setSummary(data.summary);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleReprocess = async (jobId: string) => {
    if (!confirm("미분류/실패 건을 재처리하시겠습니까?")) return;
    setReprocessing(jobId);
    try {
      const res = await fetch(`/api/sync/${jobId}/reprocess`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok) {
        alert(
          `재처리 완료: ${data.result.total}건 중 ${data.result.successCount}건 성공`
        );
        loadData();
      } else {
        alert(data.error || "재처리 실패");
      }
    } catch {
      alert("재처리 중 오류 발생");
    } finally {
      setReprocessing(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        동기화 이력 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 페이지 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">데이터 가져오기</h1>
          <p className="text-sm text-gray-500 mt-1">
            데이터 유입 이력 조회 · 상태 확인 · 재처리
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 px-3 py-2 text-sm bg-white border border-gray-200 rounded-lg hover:bg-gray-50"
        >
          <RefreshCw size={14} />
          새로고침
        </button>
      </div>

      {/* 상태 요약 카드 */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">전체 동기화</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-green-600 mb-1">성공</p>
            <p className="text-2xl font-bold text-green-600">
              {summary.success}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-amber-600 mb-1">부분 성공</p>
            <p className="text-2xl font-bold text-amber-600">
              {summary.partialSuccess}
            </p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-red-600 mb-1">실패</p>
            <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">마지막 동기화</p>
            <p className="text-sm font-medium text-gray-900">
              {summary.lastSync ? timeAgo(summary.lastSync) : "없음"}
            </p>
            {summary.lastSyncStatus && (
              <span
                className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_CONFIG[summary.lastSyncStatus]?.bg || ""} ${STATUS_CONFIG[summary.lastSyncStatus]?.color || ""}`}
              >
                {STATUS_CONFIG[summary.lastSyncStatus]?.label ||
                  summary.lastSyncStatus}
              </span>
            )}
          </div>
        </div>
      )}

      {/* 경고 배너 */}
      {summary && summary.failed > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <XCircle className="text-red-500 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-medium text-red-800">
              실패한 동기화가 {summary.failed}건 있습니다
            </p>
            <p className="text-xs text-red-600 mt-1">
              아래 이력에서 실패 건을 확인하고 재처리를 시도하세요.
            </p>
          </div>
        </div>
      )}

      {/* EMR 연동 안내 */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Server className="text-blue-500 mt-0.5 shrink-0" size={18} />
          <div>
            <p className="text-sm font-medium text-blue-800">
              EMR 연동 파이프라인
            </p>
            <p className="text-xs text-blue-600 mt-1">
              EMR 원본 → 정제/정규화 → 운영 DB 반영 흐름이 준비되어 있습니다.
              현재는 CSV Import와 Seed 기반이며, 향후 EMR API 직접 연동 시 같은
              파이프라인(SyncJob)을 사용합니다.
            </p>
            <div className="flex items-center gap-2 mt-2 text-xs text-blue-500">
              <span className="px-2 py-0.5 bg-blue-100 rounded">EMR 원본</span>
              <ArrowRight size={12} />
              <span className="px-2 py-0.5 bg-blue-100 rounded">
                정제/정규화
              </span>
              <ArrowRight size={12} />
              <span className="px-2 py-0.5 bg-blue-100 rounded">운영 DB</span>
              <ArrowRight size={12} />
              <span className="px-2 py-0.5 bg-blue-100 rounded">유입 경로 검토</span>
            </div>
          </div>
        </div>
      </div>

      {/* 동기화 이력 */}
      <div className="bg-white rounded-xl border">
        <div className="px-4 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-900">
            동기화 이력 ({jobs.length}건)
          </h2>
        </div>

        {jobs.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            동기화 이력이 없습니다. Seed 데이터를 생성하거나 CSV Import를
            실행해주세요.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {jobs.map((job) => {
              const cfg = STATUS_CONFIG[job.status] || STATUS_CONFIG.PENDING;
              const StatusIcon = cfg.icon;
              const SourceIcon =
                SOURCE_ICONS[job.sourceSystem] || Database;
              const isExpanded = selectedJob === job.id;

              return (
                <div key={job.id} className="hover:bg-gray-50/50">
                  <button
                    onClick={() =>
                      setSelectedJob(isExpanded ? null : job.id)
                    }
                    className="w-full px-4 py-3 flex items-center gap-4 text-left"
                  >
                    {/* 상태 아이콘 */}
                    <div className={`p-2 rounded-lg ${cfg.bg}`}>
                      <StatusIcon
                        size={16}
                        className={`${cfg.color} ${job.status === "RUNNING" ? "animate-spin" : ""}`}
                      />
                    </div>

                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">
                          {SYNC_TYPE_LABELS[job.syncType] || job.syncType}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${cfg.bg} ${cfg.color}`}>
                          {cfg.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <SourceIcon size={12} />
                          {job.sourceSystem}
                        </span>
                        <span>{timeAgo(job.startedAt)}</span>
                        <span>by {job.triggeredBy}</span>
                      </div>
                    </div>

                    {/* 요약 수치 */}
                    <div className="hidden md:flex items-center gap-4 text-xs">
                      <div className="text-center">
                        <p className="text-gray-400">전체</p>
                        <p className="font-medium text-gray-700">
                          {job.totalRecords}
                        </p>
                      </div>
                      <div className="text-center">
                        <p className="text-green-500">성공</p>
                        <p className="font-medium text-green-600">
                          {job.successCount}
                        </p>
                      </div>
                      {job.failedCount > 0 && (
                        <div className="text-center">
                          <p className="text-red-500">실패</p>
                          <p className="font-medium text-red-600">
                            {job.failedCount}
                          </p>
                        </div>
                      )}
                      {job.unclassifiedCount > 0 && (
                        <div className="text-center">
                          <p className="text-amber-500">미분류</p>
                          <p className="font-medium text-amber-600">
                            {job.unclassifiedCount}
                          </p>
                        </div>
                      )}
                    </div>
                  </button>

                  {/* 확장 상세 */}
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0">
                      <div className="ml-12 bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                          <div>
                            <p className="text-gray-400">시작 시각</p>
                            <p className="text-gray-700">
                              {new Date(job.startedAt).toLocaleString("ko-KR")}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">완료 시각</p>
                            <p className="text-gray-700">
                              {job.finishedAt
                                ? new Date(job.finishedAt).toLocaleString(
                                    "ko-KR"
                                  )
                                : "진행 중"}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">건너뜀/중복</p>
                            <p className="text-gray-700">
                              {job.skippedCount} / {job.duplicateCount}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400">실행자</p>
                            <p className="text-gray-700">{job.triggeredBy}</p>
                          </div>
                        </div>

                        {job.notes && (
                          <div className="text-xs">
                            <p className="text-gray-400">비고</p>
                            <p className="text-gray-700">{job.notes}</p>
                          </div>
                        )}

                        {job.errorSummary && (
                          <div className="bg-red-50 rounded p-2 text-xs text-red-700">
                            <p className="font-medium">에러 요약</p>
                            <p>{job.errorSummary}</p>
                          </div>
                        )}

                        {/* 바로가기 + 재처리 */}
                        <div className="flex items-center gap-2 pt-2">
                          {(job.unclassifiedCount > 0 ||
                            job.failedCount > 0) &&
                            user.role === "ADMIN" && (
                              <button
                                onClick={() => handleReprocess(job.id)}
                                disabled={reprocessing === job.id}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                              >
                                {reprocessing === job.id ? (
                                  <Loader2
                                    size={12}
                                    className="animate-spin"
                                  />
                                ) : (
                                  <RotateCcw size={12} />
                                )}
                                재처리
                              </button>
                            )}
                          {job.unclassifiedCount > 0 && (
                            <a
                              href="/internal/source-review"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100"
                            >
                              <ArrowRight size={12} />
                              유입 경로 검토
                            </a>
                          )}
                          {job.importBatchId && (
                            <a
                              href="/internal/import"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100"
                            >
                              <ArrowRight size={12} />
                              Import 이력
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
