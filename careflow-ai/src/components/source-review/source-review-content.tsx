"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Search,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Filter,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  BookOpen,
  Zap,
  Eye,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS, CONFIDENCE_LABELS, CONFIDENCE_COLORS } from "@/lib/attribution/rules";
import { maskName } from "@/lib/privacy";

interface ReviewItem {
  visitId: string;
  patientId: string;
  patientName: string;
  chartNumber: string;
  visitDate: string;
  sourceRaw: string | null;
  channel: string | null;
  isCta: boolean;
  normalizedSource: string | null;
  sourceCategory: string | null;
  ctaCandidate: boolean | null;
  matchConfidence: string | null;
  matchReason: string | null;
  matchedRuleName: string | null;
  reviewedSource: string | null;
  reviewedCategory: string | null;
  reviewedCtaFlag: boolean | null;
  sourceReviewStatus: string;
  sourceReviewedBy: string | null;
  sourceReviewedAt: string | null;
  sourceReviewMemo: string | null;
  finalSource: string;
  finalCategory: string;
  finalCtaFlag: boolean;
}

interface Stats {
  total: number;
  unreviewed: number;
  autoConfirmed: number;
  manuallyConfirmed: number;
  lowConfidence: number;
  ctaCandidates: number;
  unknownSource: number;
}

export function SourceReviewContent() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("unreviewed");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMasked, setShowMasked] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (confidenceFilter !== "all") params.set("confidence", confidenceFilter);
    const res = await fetch(`/api/source-review?${params.toString()}`);
    const json = await res.json();
    setItems(json.items || []);
    setStats(json.stats || null);
    setLoading(false);
  }, [statusFilter, confidenceFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleNormalizeAll() {
    setLoading(true);
    await fetch("/api/source-review", { method: "POST" });
    fetchData();
  }

  async function handleReview(visitId: string, action: string, data?: Record<string, unknown>) {
    await fetch("/api/source-review", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ visitId, action, ...data }),
    });
    fetchData();
  }

  const displayName = (name: string) => showMasked ? maskName(name) : name;

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/cta" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="h-6 w-6 text-purple-600" />
              방문경로 검토 큐
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            자유입력 방문 경로를 표준 분류로 검토하고 확정합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/source-rules"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            <BookOpen size={14} />
            분류 사전
          </Link>
          <button
            onClick={handleNormalizeAll}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-600 text-white hover:bg-purple-700"
          >
            <Zap size={14} />
            일괄 정규화 실행
          </button>
        </div>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
          <StatCard label="전체" value={stats.total} color="gray" onClick={() => setStatusFilter("all")} active={statusFilter === "all"} />
          <StatCard label="검토 필요" value={stats.unreviewed} color="amber" onClick={() => setStatusFilter("unreviewed")} active={statusFilter === "unreviewed"} />
          <StatCard label="자동 확정" value={stats.autoConfirmed} color="blue" onClick={() => setStatusFilter("auto_confirmed")} active={statusFilter === "auto_confirmed"} />
          <StatCard label="수동 확정" value={stats.manuallyConfirmed} color="green" onClick={() => setStatusFilter("manually_confirmed")} active={statusFilter === "manually_confirmed"} />
          <StatCard label="저신뢰" value={stats.lowConfidence} color="red" />
          <StatCard label="CTA 후보" value={stats.ctaCandidates} color="purple" />
          <StatCard label="미분류" value={stats.unknownSource} color="orange" />
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700">필터</span>
          </div>
          <select
            value={confidenceFilter}
            onChange={(e) => setConfidenceFilter(e.target.value)}
            className="px-3 py-1.5 border rounded-lg text-sm"
          >
            <option value="all">신뢰도: 전체</option>
            <option value="HIGH">높음만</option>
            <option value="MEDIUM">보통만</option>
            <option value="LOW">낮음만</option>
          </select>
          <button
            onClick={() => setShowMasked(!showMasked)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 ml-auto"
          >
            <Eye size={14} />
            {showMasked ? "이름 표시" : "이름 숨김"}
          </button>
          <button onClick={fetchData} className="p-1.5 rounded hover:bg-gray-100">
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 검토 목록 */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
            {statusFilter === "unreviewed"
              ? "검토가 필요한 방문경로가 없습니다"
              : "조건에 맞는 항목이 없습니다"}
          </div>
        ) : (
          items.map((item) => (
            <ReviewCard
              key={item.visitId}
              item={item}
              displayName={displayName}
              expanded={expandedId === item.visitId}
              onToggle={() => setExpandedId(expandedId === item.visitId ? null : item.visitId)}
              onReview={handleReview}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string; onClick?: () => void; active?: boolean;
}) {
  const colors: Record<string, string> = {
    gray: "text-gray-600",
    amber: "text-amber-600",
    blue: "text-blue-600",
    green: "text-green-600",
    red: "text-red-600",
    purple: "text-purple-600",
    orange: "text-orange-600",
  };
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-white border rounded-xl p-3 text-left transition-colors",
        active && "ring-2 ring-purple-500 border-purple-300",
        onClick && "hover:bg-gray-50 cursor-pointer"
      )}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn("text-xl font-bold", colors[color])}>{value}</div>
    </button>
  );
}

function ReviewCard({ item, displayName, expanded, onToggle, onReview }: {
  item: ReviewItem;
  displayName: (n: string) => string;
  expanded: boolean;
  onToggle: () => void;
  onReview: (visitId: string, action: string, data?: Record<string, unknown>) => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [editSource, setEditSource] = useState(item.normalizedSource || "");
  const [editCategory, setEditCategory] = useState(item.sourceCategory || "Unknown");
  const [editCta, setEditCta] = useState(item.ctaCandidate ?? false);
  const [memo, setMemo] = useState(item.sourceReviewMemo || "");

  const statusIcon = {
    unreviewed: <AlertTriangle size={12} className="text-amber-500" />,
    auto_confirmed: <CheckCircle2 size={12} className="text-blue-500" />,
    manually_confirmed: <CheckCircle2 size={12} className="text-green-500" />,
    rejected: <XCircle size={12} className="text-red-500" />,
  }[item.sourceReviewStatus] || <AlertTriangle size={12} className="text-gray-400" />;

  const statusLabel = {
    unreviewed: "검토 필요",
    auto_confirmed: "자동 확정",
    manually_confirmed: "수동 확정",
    rejected: "반려",
  }[item.sourceReviewStatus] || item.sourceReviewStatus;

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm">
              {statusIcon}
              <span className="font-medium text-gray-900 truncate">
                &quot;{item.sourceRaw || "(미입력)"}&quot;
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{displayName(item.patientName)}</span>
              <span className="text-gray-300">·</span>
              <span>{new Date(item.visitDate).toLocaleDateString("ko-KR")}</span>
              <span className="text-gray-300">·</span>
              <span>→ {item.finalSource}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-3">
            {item.matchConfidence && (
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-medium", CONFIDENCE_COLORS[item.matchConfidence] || "bg-gray-100 text-gray-600")}>
                {CONFIDENCE_LABELS[item.matchConfidence] || item.matchConfidence}
              </span>
            )}
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              item.finalCtaFlag ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            )}>
              {item.finalCtaFlag ? "CTA" : "비-CTA"}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
              {CATEGORY_LABELS[item.finalCategory] || item.finalCategory}
            </span>
            {expanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
          {/* 원문 → 추천 → 확정 흐름 */}
          <div className="bg-white rounded-lg p-3 border space-y-2">
            <div className="text-xs font-medium text-gray-500 mb-2">원문 → 추천 → 최종 확정 흐름</div>
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="px-2 py-1 rounded bg-gray-100 text-gray-700 text-xs">
                원문: &quot;{item.sourceRaw || "(없음)"}&quot;
              </span>
              <span className="text-gray-400">→</span>
              <span className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs">
                추천: {item.normalizedSource || "미분류"} ({CATEGORY_LABELS[item.sourceCategory || ""] || item.sourceCategory || "?"})
              </span>
              <span className="text-gray-400">→</span>
              <span className={cn(
                "px-2 py-1 rounded text-xs",
                item.reviewedSource ? "bg-green-50 text-green-700" : "bg-amber-50 text-amber-700"
              )}>
                확정: {item.reviewedSource || "(미확정)"}
              </span>
            </div>
          </div>

          <DetailRow label="상태" value={statusLabel} />
          <DetailRow label="매칭 근거" value={item.matchReason || "-"} />
          {item.matchedRuleName && (
            <DetailRow label="매칭 규칙" value={item.matchedRuleName} />
          )}
          {item.sourceReviewedBy && (
            <DetailRow label="검토자" value={`${item.sourceReviewedBy} (${item.sourceReviewedAt ? new Date(item.sourceReviewedAt).toLocaleString("ko-KR") : ""})`} />
          )}
          {item.sourceReviewMemo && (
            <DetailRow label="검토 메모" value={item.sourceReviewMemo} />
          )}

          {/* 검토 액션 */}
          {item.sourceReviewStatus === "unreviewed" && !editMode && (
            <div className="flex gap-2 pt-2 flex-wrap">
              <button
                onClick={() => onReview(item.visitId, "confirm_recommended")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              >
                <CheckCircle2 size={12} /> 추천값 그대로 확정
              </button>
              <button
                onClick={() => {
                  setEditSource(item.normalizedSource || "");
                  setEditCategory(item.sourceCategory || "Unknown");
                  setEditCta(item.ctaCandidate ?? false);
                  setEditMode(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700"
              >
                <Tag size={12} /> 수정 후 확정
              </button>
              <button
                onClick={() => onReview(item.visitId, "reject")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-300"
              >
                <XCircle size={12} /> 반려
              </button>
            </div>
          )}

          {editMode && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-medium text-amber-800">분류값 수정</div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-600 mb-1">정규화 소스</label>
                  <input
                    type="text"
                    value={editSource}
                    onChange={(e) => setEditSource(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">카테고리</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                  >
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editCta}
                    onChange={(e) => setEditCta(e.target.checked)}
                    className="rounded"
                  />
                  <span className="text-sm text-gray-700">CTA 후보</span>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">메모</label>
                  <input
                    type="text"
                    value={memo}
                    onChange={(e) => setMemo(e.target.value)}
                    className="w-full px-2 py-1 border rounded text-sm"
                    placeholder="검토 메모..."
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onReview(item.visitId, "confirm", {
                      reviewedSource: editSource,
                      reviewedCategory: editCategory,
                      reviewedCtaFlag: editCta,
                      sourceReviewMemo: memo || undefined,
                    });
                    setEditMode(false);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                >
                  <CheckCircle2 size={12} /> 확정
                </button>
                <button
                  onClick={() => setEditMode(false)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-300"
                >
                  취소
                </button>
              </div>
            </div>
          )}

          <div className="pt-1">
            <Link href={`/patients/${item.patientId}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium">
              환자 상세 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-28 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}
