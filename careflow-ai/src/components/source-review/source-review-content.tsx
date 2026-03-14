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
  Layers,
  List,
  Download,
  Upload,
  CheckCheck,
  History,
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

interface GroupedData {
  [key: string]: ReviewItem[];
}

type ViewMode = "queue" | "grouped" | "bySource";

export function SourceReviewContent() {
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [groups, setGroups] = useState<GroupedData | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("unreviewed");
  const [confidenceFilter, setConfidenceFilter] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showMasked, setShowMasked] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("queue");
  const [batchProcessing, setBatchProcessing] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (confidenceFilter !== "all") params.set("confidence", confidenceFilter);
    params.set("limit", "500");

    if (viewMode === "grouped") {
      params.set("groupBy", "raw");
    } else if (viewMode === "bySource") {
      params.set("groupBy", "normalized");
    }

    const res = await fetch(`/api/source-review?${params.toString()}`);
    const json = await res.json();
    setItems(json.items || []);
    setGroups(json.groups || null);
    setStats(json.stats || null);
    setLoading(false);
  }, [statusFilter, confidenceFilter, viewMode]);

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

  async function handleBatchAction(action: "confirm" | "reject" | "modify", sourceRaw: string, extra?: Record<string, unknown>) {
    setBatchProcessing(true);
    await fetch("/api/source-review/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, sourceRaw, ...extra }),
    });
    setBatchProcessing(false);
    fetchData();
  }

  const displayName = (name: string) => showMasked ? maskName(name) : name;

  // 검색 필터링
  const filteredItems = searchText
    ? items.filter((i) =>
        (i.sourceRaw || "").toLowerCase().includes(searchText.toLowerCase()) ||
        (i.finalSource || "").toLowerCase().includes(searchText.toLowerCase()) ||
        (i.chartNumber || "").toLowerCase().includes(searchText.toLowerCase())
      )
    : items;

  // 그룹 데이터 필터링
  const filteredGroups = groups && searchText
    ? Object.fromEntries(
        Object.entries(groups).filter(([key]) =>
          key.toLowerCase().includes(searchText.toLowerCase())
        )
      )
    : groups;

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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/cta" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Search className="h-6 w-6 text-purple-600" />
              유입 경로 검토
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            자유입력 방문 경로를 검토하고 확정합니다 · 묶음 검토로 빠르게 처리하세요
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/source-import"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            <Upload size={14} />
            CSV Import
          </Link>
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
            일괄 정규화
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
          <StatCard label="CPA 후보" value={stats.ctaCandidates} color="purple" />
          <StatCard label="미분류" value={stats.unknownSource} color="orange" />
        </div>
      )}

      {/* 뷰 모드 탭 + 필터 */}
      <div className="bg-white border rounded-xl p-4 space-y-3">
        {/* 뷰 모드 탭 */}
        <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg w-fit">
          <button
            onClick={() => setViewMode("queue")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "queue" ? "bg-white text-purple-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <List size={14} />
            검토 목록
          </button>
          <button
            onClick={() => setViewMode("grouped")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "grouped" ? "bg-white text-purple-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Layers size={14} />
            원문 묶음 검토
          </button>
          <button
            onClick={() => setViewMode("bySource")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
              viewMode === "bySource" ? "bg-white text-purple-700 shadow-sm" : "text-gray-600 hover:text-gray-900"
            )}
          >
            <Tag size={14} />
            추천값별
          </button>
        </div>

        {/* 필터 바 */}
        <div className="flex items-center gap-3 flex-wrap">
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
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="원문 또는 추천값 검색..."
              className="w-full px-3 py-1.5 border rounded-lg text-sm"
            />
          </div>
          <button
            onClick={() => setShowMasked(!showMasked)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            <Eye size={14} />
            {showMasked ? "이름 표시" : "이름 숨김"}
          </button>
          <ExportDropdown />
          <button onClick={fetchData} className="p-1.5 rounded hover:bg-gray-100">
            <RefreshCw size={14} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      {viewMode === "queue" && (
        <QueueView
          items={filteredItems}
          displayName={displayName}
          expandedId={expandedId}
          setExpandedId={setExpandedId}
          onReview={handleReview}
          statusFilter={statusFilter}
        />
      )}

      {viewMode === "grouped" && (
        <GroupedView
          groups={filteredGroups}
          displayName={displayName}
          onBatchAction={handleBatchAction}
          batchProcessing={batchProcessing}
        />
      )}

      {viewMode === "bySource" && (
        <GroupedBySourceView
          groups={filteredGroups}
          onBatchAction={handleBatchAction}
          batchProcessing={batchProcessing}
        />
      )}
    </div>
  );
}

/* ── 검토 큐 (기존 뷰 강화) ── */
function QueueView({ items, displayName, expandedId, setExpandedId, onReview, statusFilter }: {
  items: ReviewItem[];
  displayName: (n: string) => string;
  expandedId: string | null;
  setExpandedId: (id: string | null) => void;
  onReview: (visitId: string, action: string, data?: Record<string, unknown>) => void;
  statusFilter: string;
}) {
  if (items.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
        {statusFilter === "unreviewed"
          ? "검토가 필요한 방문경로가 없습니다 — 모두 처리 완료!"
          : "조건에 맞는 항목이 없습니다"}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-gray-500 mb-2">{items.length}건 표시</div>
      {items.map((item) => (
        <ReviewCard
          key={item.visitId}
          item={item}
          displayName={displayName}
          expanded={expandedId === item.visitId}
          onToggle={() => setExpandedId(expandedId === item.visitId ? null : item.visitId)}
          onReview={onReview}
        />
      ))}
    </div>
  );
}

/* ── 원문 묶음 검토 (핵심 신기능) ── */
function GroupedView({ groups, displayName, onBatchAction, batchProcessing }: {
  groups: GroupedData | null;
  displayName: (n: string) => string;
  onBatchAction: (action: "confirm" | "reject" | "modify", sourceRaw: string, extra?: Record<string, unknown>) => void;
  batchProcessing: boolean;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editSource, setEditSource] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editCta, setEditCta] = useState(false);

  if (!groups || Object.keys(groups).length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
        묶음 검토 대상이 없습니다
      </div>
    );
  }

  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  const unreviewedEntries = entries.filter(([, items]) =>
    items.some((i) => i.sourceReviewStatus === "unreviewed")
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-500">
          총 {entries.length}개 그룹 · 검토 필요 {unreviewedEntries.length}개 그룹
        </span>
        <span className="text-xs text-gray-400">
          건수가 많은 원문부터 정렬
        </span>
      </div>

      {entries.map(([rawText, groupItems]) => {
        const unreviewedCount = groupItems.filter((i) => i.sourceReviewStatus === "unreviewed").length;
        const recommendedSource = groupItems[0]?.normalizedSource || "Unknown";
        const recommendedCategory = groupItems[0]?.sourceCategory || "Unknown";
        const recommendedCta = groupItems[0]?.ctaCandidate ?? false;
        const avgConfidence = groupItems[0]?.matchConfidence || "LOW";
        const isExpanded = expandedGroup === rawText;
        const isEditing = editingGroup === rawText;

        return (
          <div key={rawText} className="bg-white border rounded-xl overflow-hidden">
            {/* 그룹 헤더 */}
            <button
              onClick={() => setExpandedGroup(isExpanded ? null : rawText)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Layers size={14} className="text-purple-500 shrink-0" />
                    <span className="font-medium text-gray-900 truncate">
                      &quot;{rawText}&quot;
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-700">
                      {groupItems.length}건
                    </span>
                    {unreviewedCount > 0 && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                        미검토 {unreviewedCount}건
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                    <span>추천: {recommendedSource}</span>
                    <span className="text-gray-300">·</span>
                    <span>{CATEGORY_LABELS[recommendedCategory] || recommendedCategory}</span>
                    <span className="text-gray-300">·</span>
                    {avgConfidence && (
                      <span className={cn("px-1 py-0.5 rounded text-[10px] font-medium", CONFIDENCE_COLORS[avgConfidence] || "bg-gray-100")}>
                        {CONFIDENCE_LABELS[avgConfidence] || avgConfidence}
                      </span>
                    )}
                    <span className={cn(
                      "px-1 py-0.5 rounded text-[10px] font-medium",
                      recommendedCta ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                    )}>
                      {recommendedCta ? "CPA" : "비-CPA"}
                    </span>
                  </div>
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {/* 그룹 확장 영역 */}
            {isExpanded && (
              <div className="border-t bg-gray-50 p-4 space-y-3">
                {/* 일괄 액션 */}
                {unreviewedCount > 0 && !isEditing && (
                  <div className="bg-white rounded-lg p-3 border flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-700">
                      일괄 처리 ({unreviewedCount}건):
                    </span>
                    <button
                      onClick={() => onBatchAction("confirm", rawText)}
                      disabled={batchProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      <CheckCheck size={12} />
                      추천값 일괄 확정
                    </button>
                    <button
                      onClick={() => {
                        setEditSource(recommendedSource);
                        setEditCategory(recommendedCategory);
                        setEditCta(recommendedCta);
                        setEditingGroup(rawText);
                      }}
                      disabled={batchProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700 disabled:opacity-50"
                    >
                      <Tag size={12} />
                      일괄 수정
                    </button>
                    <button
                      onClick={() => onBatchAction("reject", rawText)}
                      disabled={batchProcessing}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-300 disabled:opacity-50"
                    >
                      <XCircle size={12} />
                      일괄 반려
                    </button>
                  </div>
                )}

                {/* 일괄 수정 폼 */}
                {isEditing && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
                    <div className="text-xs font-medium text-amber-800">일괄 분류값 수정 ({unreviewedCount}건)</div>
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
                        <span className="text-sm text-gray-700">CPA 후보</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          onBatchAction("modify", rawText, {
                            reviewedSource: editSource,
                            reviewedCategory: editCategory,
                            reviewedCtaFlag: editCta,
                          });
                          setEditingGroup(null);
                        }}
                        disabled={batchProcessing}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
                      >
                        <CheckCircle2 size={12} /> 일괄 확정
                      </button>
                      <button
                        onClick={() => setEditingGroup(null)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                )}

                {/* 개별 항목 목록 */}
                <div className="space-y-1">
                  {groupItems.map((item) => (
                    <div key={item.visitId} className="bg-white rounded-lg px-3 py-2 border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <StatusIcon status={item.sourceReviewStatus} />
                        <span className="text-gray-600 truncate">{displayName(item.patientName)}</span>
                        <span className="text-gray-400">{item.chartNumber}</span>
                        <span className="text-gray-400">{new Date(item.visitDate).toLocaleDateString("ko-KR")}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.sourceReviewStatus === "unreviewed" ? (
                          <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-medium">미검토</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-medium">
                            {item.sourceReviewStatus === "auto_confirmed" ? "자동" : item.sourceReviewStatus === "manually_confirmed" ? "수동" : item.sourceReviewStatus === "rejected" ? "반려" : item.sourceReviewStatus}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── 추천값별 뷰 ── */
function GroupedBySourceView({ groups, onBatchAction, batchProcessing }: {
  groups: GroupedData | null;
  onBatchAction: (action: "confirm" | "reject" | "modify", sourceRaw: string, extra?: Record<string, unknown>) => void;
  batchProcessing: boolean;
}) {
  const [expandedSource, setExpandedSource] = useState<string | null>(null);

  if (!groups || Object.keys(groups).length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
        데이터가 없습니다
      </div>
    );
  }

  const entries = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="space-y-3">
      <div className="text-sm text-gray-500">
        추천 분류값 {entries.length}개 그룹
      </div>

      {entries.map(([sourceName, groupItems]) => {
        const isExpanded = expandedSource === sourceName;
        const unreviewedCount = groupItems.filter((i) => i.sourceReviewStatus === "unreviewed").length;
        const ctaCount = groupItems.filter((i) => i.finalCtaFlag).length;
        const category = groupItems[0]?.finalCategory || "Unknown";

        // 이 그룹의 원문 종류
        const rawTexts = [...new Set(groupItems.map((i) => i.sourceRaw || "(미입력)"))];

        return (
          <div key={sourceName} className="bg-white border rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedSource(isExpanded ? null : sourceName)}
              className="w-full text-left p-4 hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Tag size={14} className="text-indigo-500" />
                  <span className="font-medium text-gray-900">{sourceName}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-700">
                    {groupItems.length}건
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">
                    {CATEGORY_LABELS[category] || category}
                  </span>
                  {ctaCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-green-100 text-green-700">
                      CPA {ctaCount}건
                    </span>
                  )}
                  {unreviewedCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">
                      미검토 {unreviewedCount}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
              </div>
            </button>

            {isExpanded && (
              <div className="border-t bg-gray-50 p-4 space-y-3">
                <div className="text-xs text-gray-500 mb-2">
                  원문 종류 {rawTexts.length}가지:
                </div>
                {rawTexts.map((raw) => {
                  const count = groupItems.filter((i) => (i.sourceRaw || "(미입력)") === raw).length;
                  const unreviewedInRaw = groupItems.filter(
                    (i) => (i.sourceRaw || "(미입력)") === raw && i.sourceReviewStatus === "unreviewed"
                  ).length;

                  return (
                    <div key={raw} className="bg-white rounded-lg px-3 py-2 border flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-gray-700 truncate">&quot;{raw}&quot;</span>
                        <span className="text-gray-400">{count}건</span>
                        {unreviewedInRaw > 0 && (
                          <span className="text-amber-600">미검토 {unreviewedInRaw}</span>
                        )}
                      </div>
                      {unreviewedInRaw > 0 && raw !== "(미입력)" && (
                        <button
                          onClick={() => onBatchAction("confirm", raw)}
                          disabled={batchProcessing}
                          className="flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-[10px] font-medium rounded hover:bg-green-700 disabled:opacity-50"
                        >
                          <CheckCheck size={10} />
                          일괄 확정
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Export 드롭다운 ── */
function ExportDropdown() {
  const [open, setOpen] = useState(false);

  function handleExport(filter: string) {
    window.open(`/api/source-review/export?filter=${filter}`, "_blank");
    setOpen(false);
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
      >
        <Download size={14} />
        Export
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 bg-white border rounded-lg shadow-lg z-20 py-1 w-44">
            <button onClick={() => handleExport("all")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">전체 내보내기</button>
            <button onClick={() => handleExport("unreviewed")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">검토 필요 건</button>
            <button onClick={() => handleExport("unclassified")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">미분류 건</button>
            <button onClick={() => handleExport("low_confidence")} className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50">저신뢰 건</button>
          </div>
        </>
      )}
    </div>
  );
}

/* ── 공통 컴포넌트 ── */
function StatCard({ label, value, color, onClick, active }: {
  label: string; value: number; color: string; onClick?: () => void; active?: boolean;
}) {
  const colors: Record<string, string> = {
    gray: "text-gray-600", amber: "text-amber-600", blue: "text-blue-600",
    green: "text-green-600", red: "text-red-600", purple: "text-purple-600", orange: "text-orange-600",
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

function StatusIcon({ status }: { status: string }) {
  const icons: Record<string, React.ReactNode> = {
    unreviewed: <AlertTriangle size={10} className="text-amber-500" />,
    auto_confirmed: <CheckCircle2 size={10} className="text-blue-500" />,
    manually_confirmed: <CheckCircle2 size={10} className="text-green-500" />,
    rejected: <XCircle size={10} className="text-red-500" />,
  };
  return <>{icons[status] || <AlertTriangle size={10} className="text-gray-400" />}</>;
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
              <StatusIcon status={item.sourceReviewStatus} />
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
              {item.finalCtaFlag ? "CPA" : "비-CPA"}
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
          {item.matchedRuleName && <DetailRow label="매칭 규칙" value={item.matchedRuleName} />}
          {item.sourceReviewedBy && (
            <DetailRow label="검토자" value={`${item.sourceReviewedBy} (${item.sourceReviewedAt ? new Date(item.sourceReviewedAt).toLocaleString("ko-KR") : ""})`} />
          )}
          {item.sourceReviewMemo && <DetailRow label="검토 메모" value={item.sourceReviewMemo} />}

          {item.sourceReviewStatus === "unreviewed" && !editMode && (
            <div className="flex gap-2 pt-2 flex-wrap">
              <button
                onClick={() => onReview(item.visitId, "confirm_recommended")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
              >
                <CheckCircle2 size={12} /> 추천값 그대로 확정
              </button>
              <button
                onClick={() => { setEditSource(item.normalizedSource || ""); setEditCategory(item.sourceCategory || "Unknown"); setEditCta(item.ctaCandidate ?? false); setEditMode(true); }}
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
                  <input type="text" value={editSource} onChange={(e) => setEditSource(e.target.value)} className="w-full px-2 py-1 border rounded text-sm" />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">카테고리</label>
                  <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="w-full px-2 py-1 border rounded text-sm">
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={editCta} onChange={(e) => setEditCta(e.target.checked)} className="rounded" />
                  <span className="text-sm text-gray-700">CPA 후보</span>
                </div>
                <div>
                  <label className="block text-xs text-gray-600 mb-1">메모</label>
                  <input type="text" value={memo} onChange={(e) => setMemo(e.target.value)} className="w-full px-2 py-1 border rounded text-sm" placeholder="검토 메모..." />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { onReview(item.visitId, "confirm", { reviewedSource: editSource, reviewedCategory: editCategory, reviewedCtaFlag: editCta, sourceReviewMemo: memo || undefined }); setEditMode(false); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700"
                >
                  <CheckCircle2 size={12} /> 확정
                </button>
                <button onClick={() => setEditMode(false)} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg">취소</button>
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
