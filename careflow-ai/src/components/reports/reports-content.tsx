"use client";

import { useState, useEffect, useCallback } from "react";
import {
  TrendingUp,
  TrendingDown,
  Download,
  BarChart3,
  Users,
  Mail,
  Globe,
  RefreshCw,
  ArrowRight,
  AlertCircle,
  CheckCircle2,
  Clock,
  XCircle,
  Filter,
  ChevronDown,
} from "lucide-react";

// ── Types ──

interface KpiData {
  period: { from: string; to: string };
  cta: { total: number; confirmed: number; treatmentStarted: number; settlementEligible: number; rejected: number; confirmRate: number };
  messages: { total: number; sent: number; failed: number; blocked: number; pending: number; successRate: number };
  visits: { total: number; newPatients: number };
  tasks: { completed: number; created: number };
}

interface FunnelStage {
  stage: string;
  count: number;
  color: string;
}

interface FunnelData {
  period: { from: string; to: string };
  funnel: FunnelStage[];
}

interface MessageReportData {
  byType: { type: string; label: string; count: number }[];
  byApproval: { status: string; label: string; count: number }[];
  bySendStatus: { status: string; label: string; count: number }[];
  blockReasons: { doNotContact: number; duplicate: number; total: number };
  scheduled: number;
}

interface SourceReportData {
  topSources: { source: string; count: number }[];
  byCategory: { category: string; count: number }[];
  ctaFunnel: { candidates: number; confirmed: number; conversionRate: number };
  unclassified: number;
  byReviewStatus: { status: string; label: string; count: number }[];
  byConfidence: { confidence: string; count: number }[];
}

interface StaffMember {
  staffId: string;
  name: string;
  role: string;
  roleLabel: string;
  assigned: number;
  completed: number;
  onHold: number;
  reviewing: number;
  waitingContact: number;
  activityCount: number;
  completionRate: number;
}

interface StaffReportData {
  staff: StaffMember[];
  unassigned: number;
  byActionType: { type: string; count: number }[];
}

interface SyncReportData {
  summary: { totalJobs: number; totalRecords: number; totalSuccess: number; totalFailed: number; totalUnclassified: number; successRate: number };
  recentJobs: { id: string; type: string; typeLabel: string; status: string; statusLabel: string; startedAt: string; records: number; success: number; failed: number }[];
  imports: { id: string; fileName: string; totalRows: number; success: number; failed: number; unclassified: number; status: string; createdAt: string }[];
  dataQuality: { totalWithSource: number; unknownSource: number; lowConfidence: number; unknownRate: number; lowConfidenceRate: number };
}

type PeriodType = "today" | "week" | "month" | "30days" | "custom";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "today", label: "오늘" },
  { value: "week", label: "이번 주" },
  { value: "month", label: "이번 달" },
  { value: "30days", label: "최근 30일" },
  { value: "custom", label: "직접 지정" },
];

// ── Component ──

export function ReportsContent() {
  const [period, setPeriod] = useState<PeriodType>("30days");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [activeTab, setActiveTab] = useState<"overview" | "messages" | "sources" | "staff" | "sync">("overview");

  const [kpi, setKpi] = useState<KpiData | null>(null);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [msgReport, setMsgReport] = useState<MessageReportData | null>(null);
  const [srcReport, setSrcReport] = useState<SourceReportData | null>(null);
  const [staffReport, setStaffReport] = useState<StaffReportData | null>(null);
  const [syncReport, setSyncReport] = useState<SyncReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ period });
    if (period === "custom" && customFrom && customTo) {
      params.set("from", customFrom);
      params.set("to", customTo);
    }
    return params.toString();
  }, [period, customFrom, customTo]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = buildQuery();

    try {
      const [kpiRes, funnelRes] = await Promise.all([
        fetch(`/api/reports/kpi?${q}`).then((r) => r.json()),
        fetch(`/api/reports/funnel?${q}`).then((r) => r.json()),
      ]);
      setKpi(kpiRes);
      setFunnel(funnelRes);

      // 탭별 데이터는 해당 탭이 활성화될 때 로드
      if (activeTab === "messages" || activeTab === "overview") {
        const res = await fetch(`/api/reports/messages?${q}`).then((r) => r.json());
        setMsgReport(res);
      }
      if (activeTab === "sources" || activeTab === "overview") {
        const res = await fetch(`/api/reports/sources?${q}`).then((r) => r.json());
        setSrcReport(res);
      }
      if (activeTab === "staff") {
        const res = await fetch(`/api/reports/staff?${q}`).then((r) => r.json());
        setStaffReport(res);
      }
      if (activeTab === "sync") {
        const res = await fetch(`/api/reports/sync?${q}`).then((r) => r.json());
        setSyncReport(res);
      }
    } catch (e) {
      console.error("리포트 데이터 로드 실패:", e);
    } finally {
      setLoading(false);
    }
  }, [buildQuery, activeTab]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleExport = (type: string) => {
    const q = buildQuery();
    window.open(`/api/reports/export?type=${type}&${q}`, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">운영 리포트</h1>
          <p className="text-sm text-gray-500 mt-1">병원 운영 성과와 핵심 지표를 한눈에 확인합니다</p>
        </div>

        {/* 기간 필터 */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-gray-400" />
          <div className="relative">
            <select
              value={period}
              onChange={(e) => setPeriod(e.target.value as PeriodType)}
              className="appearance-none bg-white border border-gray-200 rounded-lg px-3 py-2 pr-8 text-sm font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {PERIOD_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
          {period === "custom" && (
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm"
              />
            </div>
          )}
        </div>
      </div>

      {/* 탭 네비게이션 */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
        {([
          { key: "overview", label: "종합", icon: BarChart3 },
          { key: "messages", label: "메시지", icon: Mail },
          { key: "sources", label: "방문경로", icon: Globe },
          { key: "staff", label: "담당자", icon: Users },
          { key: "sync", label: "동기화", icon: RefreshCw },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-white text-blue-700 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            <tab.icon size={15} />
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="animate-spin text-blue-500 mr-2" size={20} />
          <span className="text-gray-500">리포트 데이터 로딩 중...</span>
        </div>
      ) : (
        <>
          {activeTab === "overview" && kpi && funnel && (
            <OverviewTab kpi={kpi} funnel={funnel} msgReport={msgReport} srcReport={srcReport} onExport={handleExport} />
          )}
          {activeTab === "messages" && <MessagesTab data={msgReport} onExport={handleExport} />}
          {activeTab === "sources" && <SourcesTab data={srcReport} onExport={handleExport} />}
          {activeTab === "staff" && <StaffTab data={staffReport} />}
          {activeTab === "sync" && <SyncTab data={syncReport} />}
        </>
      )}
    </div>
  );
}

// ── KPI Card ──

function KpiCard({ label, value, sub, icon: Icon, color, trend }: {
  label: string;
  value: number | string;
  sub?: string;
  icon: React.ElementType;
  color: string;
  trend?: number;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className={`p-2 rounded-lg ${color}`}>
          <Icon size={18} />
        </div>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center text-xs font-medium ${trend > 0 ? "text-green-600" : "text-red-600"}`}>
            {trend > 0 ? <TrendingUp size={12} className="mr-0.5" /> : <TrendingDown size={12} className="mr-0.5" />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

// ── Overview Tab ──

function OverviewTab({ kpi, funnel, msgReport, srcReport, onExport }: {
  kpi: KpiData;
  funnel: FunnelData;
  msgReport: MessageReportData | null;
  srcReport: SourceReportData | null;
  onExport: (type: string) => void;
}) {
  const maxFunnel = Math.max(...funnel.funnel.map((f) => f.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI 카드 그리드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="CTA 유입"
          value={kpi.cta.total}
          sub={`확정률 ${kpi.cta.confirmRate}%`}
          icon={TrendingUp}
          color="bg-indigo-50 text-indigo-600"
        />
        <KpiCard
          label="정산 대상"
          value={kpi.cta.settlementEligible}
          sub={`진료개시 ${kpi.cta.treatmentStarted}건`}
          icon={CheckCircle2}
          color="bg-green-50 text-green-600"
        />
        <KpiCard
          label="메시지 발송"
          value={kpi.messages.sent}
          sub={`성공률 ${kpi.messages.successRate}% · 실패 ${kpi.messages.failed}`}
          icon={Mail}
          color="bg-blue-50 text-blue-600"
        />
        <KpiCard
          label="업무 완료"
          value={kpi.tasks.completed}
          sub={`생성 ${kpi.tasks.created}건`}
          icon={CheckCircle2}
          color="bg-amber-50 text-amber-600"
        />
      </div>

      {/* 2열: 퍼널 + 부가정보 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 운영 퍼널 */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-base font-semibold text-gray-900 mb-4">운영 퍼널</h3>
          <div className="space-y-3">
            {funnel.funnel.map((stage, i) => (
              <div key={stage.stage} className="flex items-center gap-3">
                <span className="text-xs text-gray-500 w-20 text-right shrink-0">{stage.stage}</span>
                <div className="flex-1 h-8 bg-gray-50 rounded-lg overflow-hidden relative">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${Math.max((stage.count / maxFunnel) * 100, 2)}%`,
                      backgroundColor: stage.color,
                    }}
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-700">
                    {stage.count}
                  </span>
                </div>
                {i < funnel.funnel.length - 1 && funnel.funnel[i + 1].count > 0 && stage.count > 0 && (
                  <span className="text-[10px] text-gray-400 w-12 shrink-0">
                    {Math.round((funnel.funnel[i + 1].count / stage.count) * 100)}%
                    <ArrowRight size={10} className="inline ml-0.5" />
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 빠른 요약 */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">방문 요약</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">총 방문</span>
                <span className="font-medium">{kpi.visits.total}건</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">신규 환자</span>
                <span className="font-medium">{kpi.visits.newPatients}명</span>
              </div>
            </div>
          </div>

          {msgReport && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">메시지 차단</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">수신거부</span>
                  <span className="font-medium text-red-600">{msgReport.blockReasons.doNotContact}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">중복 차단</span>
                  <span className="font-medium text-orange-600">{msgReport.blockReasons.duplicate}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">검토 대기</span>
                  <span className="font-medium text-blue-600">{kpi.messages.pending}</span>
                </div>
              </div>
            </div>
          )}

          {srcReport && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">경로 분류</h3>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">미분류</span>
                  <span className="font-medium text-red-600">{srcReport.unclassified}건</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CTA 후보</span>
                  <span className="font-medium">{srcReport.ctaFunnel.candidates}건</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">CTA 확정률</span>
                  <span className="font-medium text-green-600">{srcReport.ctaFunnel.conversionRate}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CSV 내보내기 */}
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-900 mb-3">CSV 내보내기</h3>
        <div className="flex flex-wrap gap-2">
          <ExportButton label="기간 요약" onClick={() => onExport("period_summary")} />
          <ExportButton label="CTA 정산 리스트" onClick={() => onExport("cta_settlement")} />
          <ExportButton label="메시지 현황" onClick={() => onExport("message_status")} />
          <ExportButton label="미분류 경로" onClick={() => onExport("unclassified")} />
        </div>
      </div>
    </div>
  );
}

function ExportButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <Download size={14} />
      {label}
    </button>
  );
}

// ── Messages Tab ──

function MessagesTab({ data, onExport }: { data: MessageReportData | null; onExport: (type: string) => void }) {
  if (!data) return <EmptyState message="메시지 리포트를 불러올 수 없습니다" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 유형별 */}
        <ReportCard title="메시지 유형별 현황">
          {data.byType.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.byType.map((t) => (
                <BarRow key={t.type} label={t.label} value={t.count} max={Math.max(...data.byType.map((x) => x.count), 1)} color="bg-blue-500" />
              ))}
            </div>
          )}
        </ReportCard>

        {/* 발송 상태별 */}
        <ReportCard title="발송 상태별 현황">
          {data.bySendStatus.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.bySendStatus.map((s) => {
                const colors: Record<string, string> = { SENT: "bg-green-500", FAILED: "bg-red-500", PENDING: "bg-gray-400", BLOCKED: "bg-orange-500", CANCELLED: "bg-gray-300" };
                return <BarRow key={s.status} label={s.label} value={s.count} max={Math.max(...data.bySendStatus.map((x) => x.count), 1)} color={colors[s.status] || "bg-blue-500"} />;
              })}
            </div>
          )}
        </ReportCard>

        {/* 승인 상태별 */}
        <ReportCard title="승인 상태별 현황">
          {data.byApproval.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.byApproval.map((a) => (
                <BarRow key={a.status} label={a.label} value={a.count} max={Math.max(...data.byApproval.map((x) => x.count), 1)} color="bg-indigo-500" />
              ))}
            </div>
          )}
        </ReportCard>

        {/* 차단 사유 */}
        <ReportCard title="차단 사유 분포">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <XCircle size={16} className="text-red-500" />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>수신거부 차단</span>
                  <span className="font-bold">{data.blockReasons.doNotContact}건</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <AlertCircle size={16} className="text-orange-500" />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>중복 발송 차단</span>
                  <span className="font-bold">{data.blockReasons.duplicate}건</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock size={16} className="text-blue-500" />
              <div className="flex-1">
                <div className="flex justify-between text-sm">
                  <span>예약 발송 대기</span>
                  <span className="font-bold">{data.scheduled}건</span>
                </div>
              </div>
            </div>
          </div>
        </ReportCard>
      </div>

      <div className="flex justify-end">
        <ExportButton label="메시지 현황 CSV" onClick={() => onExport("message_status")} />
      </div>
    </div>
  );
}

// ── Sources Tab ──

function SourcesTab({ data, onExport }: { data: SourceReportData | null; onExport: (type: string) => void }) {
  if (!data) return <EmptyState message="방문경로 리포트를 불러올 수 없습니다" />;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 상위 소스 */}
        <ReportCard title="상위 방문경로 (정규화 기준)">
          {data.topSources.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.topSources.slice(0, 10).map((s) => (
                <BarRow key={s.source} label={s.source} value={s.count} max={Math.max(...data.topSources.map((x) => x.count), 1)} color="bg-indigo-500" />
              ))}
            </div>
          )}
        </ReportCard>

        {/* 카테고리별 */}
        <ReportCard title="카테고리별 분포">
          {data.byCategory.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.byCategory.map((c) => {
                const catColors: Record<string, string> = {
                  "Search Ads": "bg-blue-500", SNS: "bg-pink-500", Referral: "bg-green-500",
                  Organic: "bg-teal-500", Offline: "bg-amber-500", Unknown: "bg-gray-400",
                };
                return <BarRow key={c.category} label={c.category} value={c.count} max={Math.max(...data.byCategory.map((x) => x.count), 1)} color={catColors[c.category] || "bg-gray-500"} />;
              })}
            </div>
          )}
        </ReportCard>

        {/* CTA 후보 vs 확정 */}
        <ReportCard title="CTA 후보 → 확정 전환">
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-indigo-600">{data.ctaFunnel.candidates}</p>
                <p className="text-xs text-gray-500">CTA 후보</p>
              </div>
              <div className="flex items-center justify-center">
                <ArrowRight size={20} className="text-gray-300" />
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{data.ctaFunnel.confirmed}</p>
                <p className="text-xs text-gray-500">확정</p>
              </div>
            </div>
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-sm text-gray-600">전환율 <span className="font-bold text-lg text-blue-600">{data.ctaFunnel.conversionRate}%</span></p>
            </div>
          </div>
        </ReportCard>

        {/* 검토 상태 + 미분류 */}
        <ReportCard title="검토 상태 및 데이터 품질">
          <div className="space-y-3">
            {data.byReviewStatus.map((r) => (
              <div key={r.status} className="flex justify-between text-sm">
                <span className="text-gray-600">{r.label}</span>
                <span className="font-medium">{r.count}건</span>
              </div>
            ))}
            <div className="border-t pt-3 mt-3">
              <div className="flex justify-between text-sm">
                <span className="text-red-600 font-medium">미분류 건수</span>
                <span className="font-bold text-red-600">{data.unclassified}건</span>
              </div>
            </div>
            {data.byConfidence.length > 0 && (
              <div className="border-t pt-3 mt-2">
                <p className="text-xs text-gray-400 mb-2">신뢰도 분포</p>
                {data.byConfidence.map((c) => (
                  <div key={c.confidence} className="flex justify-between text-sm">
                    <span className="text-gray-500">{c.confidence}</span>
                    <span className="font-medium">{c.count}건</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ReportCard>
      </div>

      <div className="flex justify-end">
        <ExportButton label="미분류 경로 CSV" onClick={() => onExport("unclassified")} />
      </div>
    </div>
  );
}

// ── Staff Tab ──

function StaffTab({ data }: { data: StaffReportData | null }) {
  if (!data) return <EmptyState message="담당자 리포트를 불러올 수 없습니다" />;

  return (
    <div className="space-y-6">
      {/* 담당자별 성과 테이블 */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-900">담당자별 업무 현황</h3>
        </div>
        {data.staff.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">등록된 담당자가 없습니다</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">담당자</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">역할</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">배정</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">완료</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">검토중</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">연락대기</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">보류</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">완료율</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">활동</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.staff.map((s) => (
                  <tr key={s.staffId} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">{s.roleLabel}</span>
                    </td>
                    <td className="px-4 py-3 text-right">{s.assigned}</td>
                    <td className="px-4 py-3 text-right text-green-600 font-medium">{s.completed}</td>
                    <td className="px-4 py-3 text-right">{s.reviewing}</td>
                    <td className="px-4 py-3 text-right">{s.waitingContact}</td>
                    <td className="px-4 py-3 text-right text-orange-600">{s.onHold}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-bold ${s.completionRate >= 70 ? "text-green-600" : s.completionRate >= 40 ? "text-amber-600" : "text-red-600"}`}>
                        {s.completionRate}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-500">{s.activityCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 미배정 + 유형별 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ReportCard title="미배정 업무">
          <div className="text-center py-4">
            <p className="text-3xl font-bold text-orange-600">{data.unassigned}</p>
            <p className="text-sm text-gray-500 mt-1">담당자 미배정 업무</p>
            {data.unassigned > 0 && (
              <p className="text-xs text-orange-500 mt-2">업무 배정이 필요합니다</p>
            )}
          </div>
        </ReportCard>

        <ReportCard title="액션 유형별 업무">
          {data.byActionType.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2">
              {data.byActionType.map((a) => {
                const typeLabels: Record<string, string> = {
                  CTA_REVIEW: "CTA 검토", RECALL: "리콜", CHURN_REENGAGE: "중단 복귀",
                  MESSAGE_REVIEW: "메시지 검토", PERIO_RECALL: "치주 리콜",
                  IMPLANT_FOLLOWUP: "임플란트 점검", GENERAL: "일반",
                };
                return <BarRow key={a.type} label={typeLabels[a.type] || a.type} value={a.count} max={Math.max(...data.byActionType.map((x) => x.count), 1)} color="bg-violet-500" />;
              })}
            </div>
          )}
        </ReportCard>
      </div>
    </div>
  );
}

// ── Sync Tab ──

function SyncTab({ data }: { data: SyncReportData | null }) {
  if (!data) return <EmptyState message="동기화 리포트를 불러올 수 없습니다" />;

  return (
    <div className="space-y-6">
      {/* 동기화 요약 KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="동기화 작업" value={data.summary.totalJobs} icon={RefreshCw} color="bg-blue-50 text-blue-600" />
        <KpiCard label="처리 레코드" value={data.summary.totalRecords} sub={`성공률 ${data.summary.successRate}%`} icon={CheckCircle2} color="bg-green-50 text-green-600" />
        <KpiCard label="실패 레코드" value={data.summary.totalFailed} icon={XCircle} color="bg-red-50 text-red-600" />
        <KpiCard label="미분류" value={data.summary.totalUnclassified} icon={AlertCircle} color="bg-amber-50 text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 데이터 품질 */}
        <ReportCard title="데이터 품질 지표">
          <div className="space-y-3">
            <QualityRow label="총 소스 방문" value={data.dataQuality.totalWithSource} />
            <QualityRow label="미분류(Unknown)" value={data.dataQuality.unknownSource} rate={data.dataQuality.unknownRate} bad />
            <QualityRow label="낮은 신뢰도(LOW)" value={data.dataQuality.lowConfidence} rate={data.dataQuality.lowConfidenceRate} bad />
          </div>
        </ReportCard>

        {/* 최근 동기화 */}
        <ReportCard title="최근 동기화 작업">
          {data.recentJobs.length === 0 ? <EmptyRow /> : (
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {data.recentJobs.map((j) => (
                <div key={j.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <span className="text-sm font-medium">{j.typeLabel}</span>
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      j.status === "SUCCESS" ? "bg-green-100 text-green-700" :
                      j.status === "FAILED" ? "bg-red-100 text-red-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>{j.statusLabel}</span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {j.success}/{j.records}건 · {new Date(j.startedAt).toLocaleDateString("ko-KR")}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ReportCard>
      </div>

      {/* Import 이력 */}
      {data.imports.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h3 className="text-base font-semibold text-gray-900">CSV Import 이력</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">파일명</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">전체</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">성공</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">실패</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600">미분류</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">일시</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.imports.map((i) => (
                  <tr key={i.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{i.fileName}</td>
                    <td className="px-4 py-3 text-right">{i.totalRows}</td>
                    <td className="px-4 py-3 text-right text-green-600">{i.success}</td>
                    <td className="px-4 py-3 text-right text-red-600">{i.failed}</td>
                    <td className="px-4 py-3 text-right text-amber-600">{i.unclassified}</td>
                    <td className="px-4 py-3 text-gray-500">{new Date(i.createdAt).toLocaleDateString("ko-KR")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared Components ──

function ReportCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );
}

function BarRow({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-gray-600 w-28 shrink-0 truncate" title={label}>{label}</span>
      <div className="flex-1 h-5 bg-gray-50 rounded overflow-hidden">
        <div
          className={`h-full rounded transition-all duration-300 ${color}`}
          style={{ width: `${Math.max((value / max) * 100, 3)}%` }}
        />
      </div>
      <span className="text-xs font-bold text-gray-700 w-10 text-right">{value}</span>
    </div>
  );
}

function QualityRow({ label, value, rate, bad }: { label: string; value: number; rate?: number; bad?: boolean }) {
  return (
    <div className="flex justify-between items-center text-sm">
      <span className="text-gray-600">{label}</span>
      <div className="text-right">
        <span className={`font-medium ${bad && value > 0 ? "text-red-600" : "text-gray-900"}`}>{value}건</span>
        {rate !== undefined && (
          <span className={`ml-1.5 text-xs ${bad && rate > 10 ? "text-red-500" : "text-gray-400"}`}>({rate}%)</span>
        )}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-400">
      <BarChart3 size={40} className="mb-3" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

function EmptyRow() {
  return <p className="text-sm text-gray-400 text-center py-4">데이터 없음</p>;
}
