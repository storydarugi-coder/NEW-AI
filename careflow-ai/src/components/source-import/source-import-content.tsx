"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  Upload,
  FileText,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ArrowRight,
  Download,
  Clock,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ImportResult {
  success: boolean;
  batchId?: string;
  summary?: {
    totalRows: number;
    successCount: number;
    failCount: number;
    unclassifiedCount: number;
    reviewNeededCount: number;
  };
  parseErrors?: string[];
  error?: string;
}

interface ImportBatch {
  id: string;
  fileName: string;
  totalRows: number;
  successCount: number;
  failCount: number;
  unclassifiedCount: number;
  reviewNeededCount: number;
  status: string;
  importedBy: string;
  createdAt: string;
}

const SAMPLE_CSV = `차트번호,방문경로,방문일,메모
CF-0001,인스타 광고 보고 왔어요,2026-03-10,
CF-0002,네이버에서 검색해서 왔습니다,2026-03-10,
CF-0003,지인 소개로 옴,2026-03-11,친구 추천
CF-0004,카카오 플친 쿠폰 받아서,2026-03-11,
CF-0005,그냥 지나가다 들어왔어요,2026-03-12,
CF-0006,유튜브 광고 보고 예약했습니다,2026-03-12,`;

export function SourceImportContent() {
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<string[][]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [batches, setBatches] = useState<ImportBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await fetch("/api/source-import");
      const json = await res.json();
      setBatches(json.batches || []);
    } catch { /* ignore */ }
    setLoadingBatches(false);
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);

    // 미리보기
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const lines = text.split(/\r?\n/).filter((l) => l.trim()).slice(0, 6);
      const rows = lines.map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
      setCsvPreview(rows);
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/source-import", {
        method: "POST",
        body: formData,
      });
      const json = await res.json();
      setResult(json);

      if (json.success) {
        fetchBatches();
      }
    } catch {
      setResult({ success: false, error: "Import 요청 실패" });
    }
    setImporting(false);
  }

  function handleDownloadSample() {
    const blob = new Blob(["\uFEFF" + SAMPLE_CSV], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "careflow-import-sample.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Upload className="h-6 w-6 text-indigo-600" />
            CSV 방문경로 Import
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            EMR 또는 외부 파일에서 방문경로 데이터를 가져와 정규화 파이프라인을 실행합니다
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleDownloadSample}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            <Download size={14} />
            샘플 CSV
          </button>
          <Link
            href="/source-review"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700"
          >
            검토 큐 이동 <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* CSV 포맷 안내 */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <h3 className="text-sm font-medium text-indigo-900 mb-2">CSV 포맷 안내</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-indigo-800">
          <div>
            <p className="font-medium mb-1">필수 컬럼:</p>
            <ul className="space-y-0.5">
              <li>• <code className="bg-indigo-100 px-1 rounded">방문경로</code> 또는 <code className="bg-indigo-100 px-1 rounded">sourceRaw</code></li>
            </ul>
            <p className="font-medium mt-2 mb-1">선택 컬럼:</p>
            <ul className="space-y-0.5">
              <li>• <code className="bg-indigo-100 px-1 rounded">차트번호</code> — 기존 환자에 연결</li>
              <li>• <code className="bg-indigo-100 px-1 rounded">방문일</code> — 방문 날짜 (없으면 오늘)</li>
              <li>• <code className="bg-indigo-100 px-1 rounded">메모</code> — 운영 메모</li>
            </ul>
          </div>
          <div>
            <p className="font-medium mb-1">처리 규칙:</p>
            <ul className="space-y-0.5">
              <li>• 각 행은 Visit 레코드로 생성됩니다</li>
              <li>• 차트번호가 있으면 기존 환자에 연결합니다</li>
              <li>• 차트번호가 없거나 미매칭이면 기본 환자에 연결됩니다</li>
              <li>• Import 후 자동 정규화 파이프라인이 실행됩니다</li>
              <li>• 높은 신뢰도(HIGH)는 자동 확정, 나머지는 검토 대기</li>
              <li>• 최대 5,000행, 5MB까지 처리 가능</li>
            </ul>
          </div>
        </div>
      </div>

      {/* 업로드 영역 */}
      <div
        className={cn(
          "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
          file ? "border-indigo-300 bg-indigo-50" : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={handleFileSelect}
        />
        {file ? (
          <div className="space-y-2">
            <FileText className="mx-auto h-10 w-10 text-indigo-500" />
            <p className="text-sm font-medium text-indigo-900">{file.name}</p>
            <p className="text-xs text-indigo-600">
              {(file.size / 1024).toFixed(1)}KB · 클릭하여 다른 파일 선택
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <Upload className="mx-auto h-10 w-10 text-gray-400" />
            <p className="text-sm font-medium text-gray-700">CSV 파일을 드래그하거나 클릭하여 선택</p>
            <p className="text-xs text-gray-500">UTF-8 인코딩 권장 · 최대 5MB · 최대 5,000행</p>
          </div>
        )}
      </div>

      {/* 미리보기 */}
      {csvPreview.length > 0 && (
        <div className="bg-white border rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-gray-50 border-b">
            <h3 className="text-sm font-medium text-gray-700">미리보기 (최대 5행)</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {csvPreview[0]?.map((h, i) => (
                    <th key={i} className="px-3 py-2 text-left font-medium text-gray-600">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {csvPreview.slice(1, 6).map((row, ri) => (
                  <tr key={ri} className="border-t">
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-gray-700">{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import 버튼 */}
      {file && !result?.success && (
        <button
          onClick={handleImport}
          disabled={importing}
          className="w-full py-3 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {importing ? (
            <>
              <RefreshCw size={16} className="animate-spin" />
              Import 진행 중...
            </>
          ) : (
            <>
              <Upload size={16} />
              Import 실행 + 정규화 파이프라인 시작
            </>
          )}
        </button>
      )}

      {/* Import 결과 */}
      {result && (
        <div className={cn(
          "border rounded-xl p-5",
          result.success ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"
        )}>
          <div className="flex items-center gap-2 mb-3">
            {result.success ? (
              <CheckCircle2 className="text-green-600" size={20} />
            ) : (
              <XCircle className="text-red-600" size={20} />
            )}
            <h3 className="font-medium text-gray-900">
              {result.success ? "Import 완료" : "Import 실패"}
            </h3>
          </div>

          {result.summary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
              <ResultStat label="전체 행" value={result.summary.totalRows} color="gray" />
              <ResultStat label="성공" value={result.summary.successCount} color="green" />
              <ResultStat label="실패" value={result.summary.failCount} color="red" />
              <ResultStat label="미분류" value={result.summary.unclassifiedCount} color="orange" />
              <ResultStat label="검토 필요" value={result.summary.reviewNeededCount} color="amber" />
            </div>
          )}

          {result.parseErrors && result.parseErrors.length > 0 && (
            <div className="bg-white rounded-lg p-3 border mb-3">
              <p className="text-xs font-medium text-amber-700 mb-1">파싱 경고</p>
              {result.parseErrors.slice(0, 5).map((e, i) => (
                <p key={i} className="text-xs text-amber-600 flex items-start gap-1">
                  <AlertTriangle size={10} className="mt-0.5 shrink-0" /> {e}
                </p>
              ))}
            </div>
          )}

          {result.error && (
            <p className="text-sm text-red-700">{result.error}</p>
          )}

          {result.success && (
            <div className="flex gap-2 mt-3">
              <Link
                href="/source-review"
                className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700"
              >
                검토 큐에서 확인하기 <ArrowRight size={14} />
              </Link>
              <button
                onClick={() => {
                  setFile(null);
                  setCsvPreview([]);
                  setResult(null);
                }}
                className="px-4 py-2 border text-sm font-medium rounded-lg hover:bg-gray-50"
              >
                새 파일 Import
              </button>
            </div>
          )}
        </div>
      )}

      {/* Import 이력 */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Clock size={14} />
            Import 이력
          </h3>
          <button onClick={fetchBatches} className="p-1 rounded hover:bg-gray-200">
            <RefreshCw size={12} className="text-gray-500" />
          </button>
        </div>
        {loadingBatches ? (
          <div className="p-4">
            <div className="h-12 bg-gray-100 rounded animate-pulse" />
          </div>
        ) : batches.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-400">
            아직 Import 이력이 없습니다
          </div>
        ) : (
          <div className="divide-y">
            {batches.map((b) => (
              <div key={b.id} className="px-4 py-3 flex items-center justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{b.fileName}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(b.createdAt).toLocaleString("ko-KR")} · {b.importedBy}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs shrink-0">
                  <span className="text-gray-500">{b.totalRows}행</span>
                  <span className="text-green-600">{b.successCount} 성공</span>
                  {b.failCount > 0 && <span className="text-red-600">{b.failCount} 실패</span>}
                  {b.reviewNeededCount > 0 && <span className="text-amber-600">{b.reviewNeededCount} 검토</span>}
                  <span className={cn(
                    "px-1.5 py-0.5 rounded text-[10px] font-medium",
                    b.status === "completed" ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"
                  )}>
                    {b.status === "completed" ? "완료" : "처리중"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: "text-gray-700",
    green: "text-green-700",
    red: "text-red-700",
    orange: "text-orange-700",
    amber: "text-amber-700",
  };
  return (
    <div className="bg-white rounded-lg p-3 border text-center">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn("text-lg font-bold", colors[color])}>{value}</div>
    </div>
  );
}
