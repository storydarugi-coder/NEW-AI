"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Megaphone,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  ChevronDown,
  ChevronUp,
  Stethoscope,
  Users,
  Receipt,
  Eye,
  EyeOff,
  Copy,
  TrendingUp,
  Download,
  ToggleLeft,
  ToggleRight,
  MessageSquare,
  ListChecks,
  Ban,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  CHANNEL_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
} from "@/types";
import { maskName } from "@/lib/privacy";
import { CATEGORY_LABELS, CONFIDENCE_LABELS, CONFIDENCE_COLORS } from "@/lib/attribution/rules";

interface Lead {
  id: string;
  visitId: string;
  patientId: string;
  patientName: string;
  chartNumber: string;
  visitDate: string;
  sourceRaw: string | null;
  channel: string | null;
  campaignId: string;
  campaignName: string;
  platform: string;
  reviewStatus: string;
  autoReason: string | null;
  confidence: number | null;
  reviewer: string | null;
  reviewedAt: string | null;
  reviewMemo: string | null;
  treatmentStarted: boolean;
  isDuplicate: boolean;
  settlementMonth: string | null;
  settlementEligible: boolean;
  ineligibleReason: string | null;
  procedures: { code: string; name: string }[];
  // 정규화 정보
  normalizedSource: string | null;
  sourceCategory: string | null;
  matchConfidence: string | null;
  reviewedSource: string | null;
  reviewedCategory: string | null;
  sourceReviewStatus: string;
  finalSource: string | null;
  finalCategory: string | null;
}

interface CampaignStat {
  id: string;
  name: string;
  platform: string;
  status: string;
  costPerClick: number | null;
  budgetWon: number | null;
  totalLeads: number;
  confirmed: number;
  pending: number;
  rejected: number;
  treatmentStarted: number;
  settlementEligible: number;
  duplicateCount: number;
  settlementAmount: number;
}

interface Summary {
  totalLeads: number;
  pending: number;
  confirmed: number;
  rejected: number;
  treatmentStarted: number;
  treatmentNotStarted: number;
  settlementEligible: number;
  duplicateExcluded: number;
  totalSettlementAmount: number;
}

interface CtaData {
  leads: Lead[];
  campaignStats: CampaignStat[];
  summary: Summary;
  availableMonths: string[];
}

export function CtaContent() {
  const [data, setData] = useState<CtaData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"leads" | "campaigns" | "settlement">("leads");
  const [showMasked, setShowMasked] = useState(true);
  const [expandedLead, setExpandedLead] = useState<string | null>(null);

  // 필터
  const [monthFilter, setMonthFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [treatmentFilter, setTreatmentFilter] = useState("all");
  const [settlementFilter, setSettlementFilter] = useState("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (monthFilter !== "all") params.set("month", monthFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (treatmentFilter !== "all") params.set("treatment", treatmentFilter);
    if (settlementFilter !== "all") params.set("settlement", settlementFilter);

    const res = await fetch(`/api/cta?${params.toString()}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [monthFilter, statusFilter, treatmentFilter, settlementFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleReview(attributionId: string, reviewStatus: "confirmed" | "rejected") {
    await fetch("/api/cta/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributionId, reviewStatus }),
    });
    fetchData();
  }

  async function handleUpdate(attributionId: string, updates: Record<string, unknown>) {
    await fetch("/api/cta/update", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ attributionId, ...updates }),
    });
    fetchData();
  }

  function handleCsvExport() {
    const params = new URLSearchParams();
    if (monthFilter !== "all") params.set("month", monthFilter);
    window.open(`/api/cta/export?${params.toString()}`, "_blank");
  }

  if (loading || !data) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  const { leads, campaignStats, summary, availableMonths } = data;
  const displayName = (name: string) => showMasked ? maskName(name) : name;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Megaphone className="h-6 w-6 text-blue-600" />
            CPA 광고 관리
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            CPA 광고를 통해 내원한 환자를 검토하고 정산 근거를 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/internal/source-review"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 text-purple-700"
          >
            <ListChecks size={14} />
            유입 경로 검토
          </Link>
          <Link
            href="/internal/source-rules"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 text-indigo-700"
          >
            유입 경로 규칙
          </Link>
          <button
            onClick={handleCsvExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 text-emerald-700"
          >
            <Download size={14} />
            CSV 내보내기
          </button>
          <button
            onClick={() => setShowMasked(!showMasked)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            {showMasked ? <EyeOff size={14} /> : <Eye size={14} />}
            {showMasked ? "이름 표시" : "이름 숨김"}
          </button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <KpiCard label="전체 유입" value={summary.totalLeads} icon={<Users size={16} />} color="blue" />
        <KpiCard label="검토 필요" value={summary.pending} icon={<Clock size={16} />} color="amber" />
        <KpiCard label="확정" value={summary.confirmed} icon={<CheckCircle2 size={16} />} color="green" />
        <KpiCard label="진료 시작" value={summary.treatmentStarted} icon={<Stethoscope size={16} />} color="purple" />
        <KpiCard
          label="정산 대상"
          value={summary.settlementEligible}
          subtext={`${summary.totalSettlementAmount.toLocaleString()}원`}
          icon={<Receipt size={16} />}
          color="emerald"
        />
      </div>

      {/* 주의사항 */}
      {(summary.duplicateExcluded > 0 || summary.treatmentNotStarted > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2 text-sm">
          <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
          <div className="text-amber-800">
            {summary.duplicateExcluded > 0 && (
              <span>중복 제외 {summary.duplicateExcluded}건 · </span>
            )}
            {summary.treatmentNotStarted > 0 && (
              <span>진료 미시작 {summary.treatmentNotStarted}건</span>
            )}
            <span className="text-amber-600 ml-1">— 정산 대상에서 제외됩니다</span>
          </div>
        </div>
      )}

      {/* 필터 */}
      <div className="bg-white border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm font-medium text-gray-700">필터</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <FilterSelect
            label="정산 월"
            value={monthFilter}
            onChange={setMonthFilter}
            options={[{ value: "all", label: "전체 기간" }, ...availableMonths.map((m) => ({ value: m, label: m }))]}
          />
          <FilterSelect
            label="검토 상태"
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "pending", label: "검토 필요" },
              { value: "confirmed", label: "확정" },
              { value: "rejected", label: "반려" },
            ]}
          />
          <FilterSelect
            label="진료 여부"
            value={treatmentFilter}
            onChange={setTreatmentFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "started", label: "진료 시작" },
              { value: "not_started", label: "상담/검사만" },
            ]}
          />
          <FilterSelect
            label="정산 대상"
            value={settlementFilter}
            onChange={setSettlementFilter}
            options={[
              { value: "all", label: "전체" },
              { value: "eligible", label: "정산 대상" },
              { value: "ineligible", label: "정산 미인정" },
            ]}
          />
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: "leads", label: "유입 환자 목록", icon: Users },
          { key: "campaigns", label: "캠페인별 집계", icon: Megaphone },
          { key: "settlement", label: "정산 요약", icon: Receipt },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-sm font-medium transition-colors",
              activeTab === tab.key
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            )}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* 콘텐츠 */}
      {activeTab === "leads" && (
        <div className="space-y-3">
          {leads.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-8 text-center text-gray-500">
              조건에 맞는 유입 환자가 없습니다
            </div>
          ) : (
            leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                displayName={displayName}
                expanded={expandedLead === lead.id}
                onToggle={() => setExpandedLead(expandedLead === lead.id ? null : lead.id)}
                onReview={handleReview}
                onUpdate={handleUpdate}
              />
            ))
          )}
        </div>
      )}

      {activeTab === "campaigns" && (
        <div className="grid gap-4 md:grid-cols-2">
          {campaignStats.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}

      {activeTab === "settlement" && (
        <SettlementTab campaignStats={campaignStats} summary={summary} monthFilter={monthFilter} onCsvExport={handleCsvExport} />
      )}
    </div>
  );
}

// ── 서브 컴포넌트 ──

function KpiCard({ label, value, subtext, icon, color }: {
  label: string; value: number; subtext?: string; icon: React.ReactNode; color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-green-50 text-green-600",
    purple: "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600",
  };
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className={cn("p-1.5 rounded-lg", colorMap[color])}>{icon}</div>
        <span className="text-xs text-gray-500">{label}</span>
      </div>
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      {subtext && <div className="text-xs text-gray-500 mt-0.5">{subtext}</div>}
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-1.5 bg-white border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      >
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

function LeadCard({ lead, displayName, expanded, onToggle, onReview, onUpdate }: {
  lead: Lead; displayName: (n: string) => string; expanded: boolean;
  onToggle: () => void; onReview: (id: string, s: "confirmed" | "rejected") => void;
  onUpdate: (id: string, updates: Record<string, unknown>) => void;
}) {
  const statusColor = REVIEW_STATUS_COLORS[lead.reviewStatus as keyof typeof REVIEW_STATUS_COLORS] || "bg-gray-100 text-gray-600";
  const channelLabel = CHANNEL_LABELS[lead.channel || "unknown"] || lead.channel || "미분류";

  return (
    <div className="bg-white border rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4 hover:bg-gray-50 transition-colors">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Link href={`/patients/${lead.patientId}`} onClick={(e) => e.stopPropagation()} className="font-medium text-gray-900 hover:text-blue-600">
                {displayName(lead.patientName)}
              </Link>
              <span className="text-xs text-gray-400">{lead.chartNumber}</span>
              {lead.isDuplicate && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                  <Copy size={10} className="inline mr-0.5" />중복
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
              <span>{new Date(lead.visitDate).toLocaleDateString("ko-KR")}</span>
              <span className="text-gray-300">·</span>
              <span>{channelLabel}</span>
              <span className="text-gray-300">·</span>
              <span>{lead.campaignName}</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium",
              lead.treatmentStarted ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-500"
            )}>
              {lead.treatmentStarted ? "진료 시작" : "상담만"}
            </span>
            <span className={cn("px-2 py-0.5 rounded-full text-[11px] font-medium border", statusColor)}>
              {REVIEW_STATUS_LABELS[lead.reviewStatus as keyof typeof REVIEW_STATUS_LABELS] || lead.reviewStatus}
            </span>
            {lead.settlementEligible && (
              <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-100 text-emerald-700">정산 대상</span>
            )}
            {expanded ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-4 bg-gray-50 space-y-3">
          <DetailRow label="방문 경로 원문" value={lead.sourceRaw || "(미입력)"} />
          {/* 정규화 정보 */}
          {lead.normalizedSource && (
            <div className="bg-white rounded-lg p-2.5 border space-y-1">
              <div className="text-xs font-medium text-gray-500">경로 정규화</div>
              <div className="flex items-center gap-2 text-xs flex-wrap">
                <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700">
                  추천: {lead.normalizedSource}
                </span>
                {lead.matchConfidence && (
                  <span className={cn("px-1.5 py-0.5 rounded", CONFIDENCE_COLORS[lead.matchConfidence] || "bg-gray-100")}>
                    {CONFIDENCE_LABELS[lead.matchConfidence] || lead.matchConfidence}
                  </span>
                )}
                {lead.sourceCategory && (
                  <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                    {CATEGORY_LABELS[lead.sourceCategory] || lead.sourceCategory}
                  </span>
                )}
                {lead.reviewedSource && lead.reviewedSource !== lead.normalizedSource && (
                  <>
                    <span className="text-gray-400">→</span>
                    <span className="px-1.5 py-0.5 rounded bg-green-50 text-green-700">
                      확정: {lead.reviewedSource}
                    </span>
                  </>
                )}
              </div>
            </div>
          )}
          <DetailRow label="분류 결과" value={channelLabel} />
          <DetailRow label="자동 분류 근거" value={lead.autoReason || "-"} />
          {lead.confidence != null && <DetailRow label="분류 신뢰도" value={`${Math.round(lead.confidence * 100)}%`} />}
          <DetailRow label="캠페인" value={`${lead.campaignName} (${lead.platform})`} />

          {/* 진료 시작 여부 + 토글 */}
          <div className="flex items-start gap-2 text-sm">
            <span className="w-32 shrink-0 text-gray-500">진료 시작 여부</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {lead.treatmentStarted
                  ? <span className="text-purple-700 font-medium">실제 진료 시작됨</span>
                  : <span className="text-gray-500">상담/검사만 — 진료 미시작</span>
                }
                <button
                  onClick={() => onUpdate(lead.id, { treatmentStarted: !lead.treatmentStarted })}
                  className={cn(
                    "ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    lead.treatmentStarted
                      ? "border-gray-300 text-gray-500 hover:bg-gray-100"
                      : "border-purple-300 text-purple-700 hover:bg-purple-50"
                  )}
                >
                  {lead.treatmentStarted ? <ToggleRight size={12} /> : <ToggleLeft size={12} />}
                  {lead.treatmentStarted ? "미시작으로 변경" : "진료 시작으로 변경"}
                </button>
              </div>
              {lead.procedures.length > 0 && (
                <div className="text-xs text-gray-400 mt-0.5">처치: {lead.procedures.map((p) => p.name).join(", ")}</div>
              )}
            </div>
          </div>

          {/* 정산 인정 + 수동 처리 */}
          <div className="flex items-start gap-2 text-sm">
            <span className="w-32 shrink-0 text-gray-500">정산 인정</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {lead.settlementEligible
                  ? <span className="text-emerald-700 font-medium">정산 대상 인정</span>
                  : <span className="text-red-600">{lead.ineligibleReason || "미인정"}</span>
                }
                <button
                  onClick={() => onUpdate(lead.id, {
                    settlementEligible: !lead.settlementEligible,
                    ...(!lead.settlementEligible ? {} : { ineligibleReason: "수동 제외 처리" }),
                  })}
                  className={cn(
                    "ml-2 flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium border transition-colors",
                    lead.settlementEligible
                      ? "border-red-300 text-red-600 hover:bg-red-50"
                      : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                  )}
                >
                  {lead.settlementEligible ? <Ban size={12} /> : <CheckCircle2 size={12} />}
                  {lead.settlementEligible ? "정산 제외" : "정산 인정"}
                </button>
              </div>
            </div>
          </div>

          {lead.settlementMonth && <DetailRow label="정산 월" value={lead.settlementMonth} />}

          {lead.isDuplicate && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-2 text-xs text-orange-700">
              동일 환자의 중복 유입 — 같은 환자는 1회만 정산 인정됩니다
            </div>
          )}

          {lead.reviewer && (
            <>
              <DetailRow label="검토자" value={lead.reviewer} />
              <DetailRow label="검토 일시" value={lead.reviewedAt ? new Date(lead.reviewedAt).toLocaleString("ko-KR") : "-"} />
            </>
          )}

          {/* 검토 메모 입력/수정 */}
          <div className="flex items-start gap-2 text-sm">
            <span className="w-32 shrink-0 text-gray-500 flex items-center gap-1">
              <MessageSquare size={12} /> 메모
            </span>
            <MemoInput
              value={lead.reviewMemo || ""}
              onSave={(memo) => onUpdate(lead.id, { reviewMemo: memo })}
            />
          </div>

          {lead.reviewStatus === "pending" && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => onReview(lead.id, "confirmed")} className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700">
                <CheckCircle2 size={14} /> 확정
              </button>
              <button onClick={() => onReview(lead.id, "rejected")} className="flex items-center gap-1.5 px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300">
                <XCircle size={14} /> 반려
              </button>
            </div>
          )}

          {/* CRM 연결 */}
          <div className="pt-2 border-t flex items-center gap-3">
            <Link href={`/patients/${lead.patientId}`} className="text-sm text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
              <ListChecks size={14} /> 환자 상세 / CRM 보기 →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function MemoInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  if (!editing) {
    return (
      <div className="flex items-center gap-2 flex-1">
        <span className="text-gray-700">{value || "(메모 없음)"}</span>
        <button onClick={() => { setText(value); setEditing(true); }} className="text-blue-600 text-[11px] hover:underline">
          {value ? "수정" : "작성"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 flex-1">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="flex-1 px-2 py-1 border rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        placeholder="메모 입력..."
        autoFocus
        onKeyDown={(e) => {
          if (e.key === "Enter") { onSave(text); setEditing(false); }
          if (e.key === "Escape") setEditing(false);
        }}
      />
      <button onClick={() => { onSave(text); setEditing(false); }} className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700">저장</button>
      <button onClick={() => setEditing(false)} className="px-2 py-1 bg-gray-200 text-gray-600 text-xs rounded hover:bg-gray-300">취소</button>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 text-sm">
      <span className="w-32 shrink-0 text-gray-500">{label}</span>
      <span className="text-gray-900">{value}</span>
    </div>
  );
}

function CampaignCard({ campaign: c }: { campaign: CampaignStat }) {
  const platformColors: Record<string, string> = {
    naver: "bg-green-100 text-green-700",
    google: "bg-blue-100 text-blue-700",
    kakao: "bg-yellow-100 text-yellow-700",
    instagram: "bg-pink-100 text-pink-700",
  };
  return (
    <div className="bg-white border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900">{c.name}</h3>
          <span className={cn("inline-block px-2 py-0.5 rounded text-xs font-medium mt-1", platformColors[c.platform] || "bg-gray-100 text-gray-600")}>{c.platform}</span>
        </div>
        {c.costPerClick != null && (
          <div className="text-right">
            <div className="text-xs text-gray-500">CPC</div>
            <div className="text-sm font-medium">{c.costPerClick.toLocaleString()}원</div>
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <MiniStat label="전체" value={c.totalLeads} />
        <MiniStat label="확정" value={c.confirmed} color="green" />
        <MiniStat label="검토중" value={c.pending} color="amber" />
        <MiniStat label="반려" value={c.rejected} color="gray" />
      </div>
      <div className="border-t pt-2 grid grid-cols-3 gap-2 text-center">
        <MiniStat label="진료시작" value={c.treatmentStarted} color="purple" />
        <MiniStat label="중복제외" value={c.duplicateCount} color="orange" />
        <MiniStat label="정산대상" value={c.settlementEligible} color="emerald" />
      </div>
      {c.settlementAmount > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2 text-center">
          <div className="text-xs text-emerald-600">정산 가능 금액</div>
          <div className="text-lg font-bold text-emerald-700">{c.settlementAmount.toLocaleString()}원</div>
        </div>
      )}
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number; color?: string }) {
  const c: Record<string, string> = { green: "text-green-700", amber: "text-amber-700", gray: "text-gray-500", purple: "text-purple-700", orange: "text-orange-700", emerald: "text-emerald-700" };
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className={cn("text-lg font-bold", color ? c[color] : "text-gray-900")}>{value}</div>
    </div>
  );
}

function SettlementTab({ campaignStats, summary, monthFilter, onCsvExport }: { campaignStats: CampaignStat[]; summary: Summary; monthFilter: string; onCsvExport: () => void }) {
  return (
    <div className="space-y-4">
      <div className="bg-white border rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Receipt size={18} className="text-emerald-600" />
            정산 요약 {monthFilter !== "all" && <span className="text-sm font-normal text-gray-500">({monthFilter})</span>}
          </h3>
          <button
            onClick={onCsvExport}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50 text-emerald-700"
          >
            <Download size={14} />
            정산 데이터 CSV 내보내기
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div><div className="text-xs text-gray-500">CPA 전체 유입</div><div className="text-xl font-bold">{summary.totalLeads}명</div></div>
          <div><div className="text-xs text-gray-500">확정</div><div className="text-xl font-bold text-green-700">{summary.confirmed}명</div></div>
          <div><div className="text-xs text-gray-500">진료 시작</div><div className="text-xl font-bold text-purple-700">{summary.treatmentStarted}명</div></div>
          <div><div className="text-xs text-gray-500">최종 정산 대상</div><div className="text-xl font-bold text-emerald-700">{summary.settlementEligible}명</div></div>
        </div>

        <div className="bg-gray-50 rounded-lg p-4">
          <h4 className="text-sm font-medium text-gray-700 mb-2 flex items-center gap-1"><TrendingUp size={14} /> 정산 인정 흐름</h4>
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <StepBadge label="전체 유입" count={summary.totalLeads} color="blue" />
            <span className="text-gray-400">→</span>
            <StepBadge label="확정" count={summary.confirmed} color="green" />
            <span className="text-gray-400">→</span>
            <StepBadge label="진료 시작" count={summary.treatmentStarted} color="purple" />
            <span className="text-gray-400">→</span>
            <StepBadge label={`중복 제외 (−${summary.duplicateExcluded})`} count={null} color="orange" />
            <span className="text-gray-400">→</span>
            <StepBadge label="정산 대상" count={summary.settlementEligible} color="emerald" />
          </div>
        </div>

        <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-800">
          <strong>정산 인정 기준:</strong>
          <ol className="list-decimal ml-4 mt-1 space-y-0.5">
            <li>CPA 광고 유입으로 검토/확정됨</li>
            <li>실제 진료를 시작한 환자 (상담/예약만은 불인정)</li>
            <li>같은 환자는 1회만 인정 (중복 제외)</li>
            <li>월 기준으로 집계</li>
          </ol>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-6">
        <h3 className="font-bold text-gray-900 mb-4">캠페인별 정산</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">캠페인</th>
                <th className="pb-2 font-medium text-center">유입</th>
                <th className="pb-2 font-medium text-center">확정</th>
                <th className="pb-2 font-medium text-center">진료시작</th>
                <th className="pb-2 font-medium text-center">중복제외</th>
                <th className="pb-2 font-medium text-center">정산대상</th>
                <th className="pb-2 font-medium text-right">CPC</th>
                <th className="pb-2 font-medium text-right">정산금액</th>
              </tr>
            </thead>
            <tbody>
              {campaignStats.map((c) => (
                <tr key={c.id} className="border-b last:border-0">
                  <td className="py-2"><div className="font-medium">{c.name}</div><div className="text-xs text-gray-400">{c.platform}</div></td>
                  <td className="py-2 text-center">{c.totalLeads}</td>
                  <td className="py-2 text-center text-green-700">{c.confirmed}</td>
                  <td className="py-2 text-center text-purple-700">{c.treatmentStarted}</td>
                  <td className="py-2 text-center text-orange-600">{c.duplicateCount}</td>
                  <td className="py-2 text-center font-bold text-emerald-700">{c.settlementEligible}</td>
                  <td className="py-2 text-right">{c.costPerClick?.toLocaleString() || "-"}원</td>
                  <td className="py-2 text-right font-bold">{c.settlementAmount.toLocaleString()}원</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 font-bold">
                <td className="pt-2">합계</td>
                <td className="pt-2 text-center">{summary.totalLeads}</td>
                <td className="pt-2 text-center text-green-700">{summary.confirmed}</td>
                <td className="pt-2 text-center text-purple-700">{summary.treatmentStarted}</td>
                <td className="pt-2 text-center text-orange-600">{summary.duplicateExcluded}</td>
                <td className="pt-2 text-center text-emerald-700">{summary.settlementEligible}</td>
                <td className="pt-2 text-right">-</td>
                <td className="pt-2 text-right text-emerald-700">{summary.totalSettlementAmount.toLocaleString()}원</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function StepBadge({ label, count, color }: { label: string; count: number | null; color: string }) {
  const c: Record<string, string> = { blue: "bg-blue-100 text-blue-700", green: "bg-green-100 text-green-700", purple: "bg-purple-100 text-purple-700", orange: "bg-orange-100 text-orange-700", emerald: "bg-emerald-100 text-emerald-700" };
  return <span className={cn("px-2 py-1 rounded-lg text-xs font-medium", c[color])}>{label}{count !== null && ` ${count}명`}</span>;
}
