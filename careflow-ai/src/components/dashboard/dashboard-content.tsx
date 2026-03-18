"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertTriangle,
  CalendarClock,
  MessageSquare,
  Users,
  ChevronRight,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  PhoneCall,
  Info,
  Megaphone,
  ClipboardList,
  Search,
  Mail,
  BarChart3,
  Loader2,
  Sparkles,
} from "lucide-react";
import {
  RULE_TYPE_LABELS,
  SUB_TYPE_LABELS,
  type RuleType,
  type SubType,
} from "@/types";

interface Detection {
  ruleType: string;
  subType: string;
  priority: number;
  reason: string;
}

interface ScoreFactor {
  label: string;
  score: number;
  reason: string;
}

interface PriorityPatient {
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  topPriority: number;
  priorityScore: number;
  scoreFactors: ScoreFactor[];
  lastVisitDate: string | null;
  detections: Detection[];
}

interface WeeklyChange {
  change: number;
  label: string;
}

interface WorkflowSummary {
  totalActive: number;
  unprocessed: number;
  todayFollowUps: number;
  overdueFollowUps: number;
}

interface SourceReviewStats {
  unreviewedCount: number;
  unclassifiedCount: number;
  lowConfidenceCount: number;
  totalWithSource: number;
  recentImport?: {
    fileName: string;
    importedAt: string;
    count: number;
  } | null;
}

interface SyncStats {
  lastSync: string | null;
  lastSyncStatus: string | null;
  failedCount: number;
  runningCount: number;
}

interface MessageStats {
  reviewNeeded: number;
  approved: number;
  sentToday: number;
  failed: number;
  blocked: number;
}

interface AIMetrics {
  generation: {
    totalGenerated: number;
    byType: { ai: number; template: number; fallback: number };
    fallbackRate: number;
    fallbackReasons: Record<string, number>;
    bySubType: Record<string, { ai: number; template: number; fallback: number; total: number; fallbackRate: number }>;
  };
  send: {
    totalAttempted: number;
    sent: number;
    failed: number;
    blocked: number;
    successRate: number;
    blockReasons: Record<string, number>;
  };
  byType: {
    byMessageType: Record<string, { total: number; sent: number; failed: number; blocked: number }>;
  };
}

interface SecondaryStats {
  ctaStats?: {
    totalLeads: number;
    pendingReview: number;
    confirmed: number;
    settlementEligible: number;
  };
  workflowSummary?: WorkflowSummary;
  sourceReviewStats?: SourceReviewStats;
  syncStats?: SyncStats;
  messageStats?: MessageStats;
}

interface DashboardContentProps {
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
  urgentPatients: PriorityPatient[];
  priorityPatients: PriorityPatient[];
}

const statCards = [
  { key: "todayActionCount" as const, changeKey: "todayAction" as const, label: "오늘 확인할 환자", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "treatmentDropoutCount" as const, changeKey: "treatmentDropout" as const, label: "치료 중단 의심", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  { key: "recallDueCount" as const, changeKey: "recallDue" as const, label: "리콜 예정", icon: CalendarClock, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "messageSuggestionCount" as const, changeKey: "messageSuggestion" as const, label: "문자 발송 추천", icon: MessageSquare, color: "text-green-600", bg: "bg-green-50" },
];

const FALLBACK_REASON_LABELS: Record<string, string> = {
  timeout: "타임아웃",
  auth_error: "인증 오류",
  rate_limit: "요청 한도",
  safety_filter: "안전 필터",
  parse_error: "응답 파싱",
  validation_failed: "검증 실패",
  server_error: "서버 오류",
  provider_unavailable: "미설정",
  template_error: "템플릿 오류",
  unknown: "알 수 없음",
};

function getRuleColor(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout": return "bg-red-100 text-red-700 border-red-200";
    case "scaling_recall": return "bg-amber-100 text-amber-700 border-amber-200";
    case "implant_followup": return "bg-blue-100 text-blue-700 border-blue-200";
    case "potential_demand": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function ChangeIndicator({ change }: { change: WeeklyChange }) {
  if (change.change > 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-red-500">
        <TrendingUp size={12} />+{change.change}
      </span>
    );
  }
  if (change.change < 0) {
    return (
      <span className="flex items-center gap-0.5 text-xs text-green-500">
        <TrendingDown size={12} />{change.change}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-0.5 text-xs text-gray-400">
      <Minus size={12} />변동없음
    </span>
  );
}

function ScoreTooltip({ score, factors }: { score: number; factors: ScoreFactor[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <span className="inline-flex items-center gap-1 cursor-help">
        <span className={`text-sm font-bold ${score >= 50 ? "text-red-600" : score >= 30 ? "text-amber-600" : "text-blue-600"}`}>
          {score}점
        </span>
        <Info size={12} className="text-gray-400" />
      </span>
      {open && (
        <div className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 w-[260px] bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-gray-900">우선순위 점수 산정 근거</p>
            {factors.map((f, i) => (
              <div key={i} className="flex justify-between gap-3 text-xs">
                <span className="text-gray-600">{f.label}: {f.reason}</span>
                <span className="font-medium shrink-0">+{f.score}</span>
              </div>
            ))}
            <div className="border-t pt-1 flex justify-between text-xs font-medium">
              <span>합계</span>
              <span>{score}점</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** 부가 통계 스켈레톤 */
function SecondaryStatsSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((i) => (
        <Card key={i} className="border-0 shadow-sm border-l-4 border-l-gray-200">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-gray-100" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 bg-gray-100 rounded w-24" />
                <div className="h-3 bg-gray-50 rounded w-48" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function DashboardContent({
  stats,
  weeklyChanges,
  urgentPatients,
  priorityPatients,
}: DashboardContentProps) {
  const [secondary, setSecondary] = useState<SecondaryStats | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(true);
  const [aiMetrics, setAiMetrics] = useState<AIMetrics | null>(null);
  const [outcomeMetrics, setOutcomeMetrics] = useState<{
    conversionRate: number;
    totalSent: number;
    totalRevisited: number;
    avgDaysToRevisit: number | null;
    byGeneratedBy: Record<string, { sent: number; revisited: number; rate: number }>;
  } | null>(null);

  // 부가 통계를 클라이언트에서 lazy fetch
  useEffect(() => {
    fetch("/api/dashboard/secondary-stats")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setSecondary(data))
      .catch(() => setSecondary(null))
      .finally(() => setSecondaryLoading(false));

    fetch("/api/reports/ai-metrics?period=30days")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAiMetrics(data?.generation ? data : null))
      .catch(() => setAiMetrics(null));

    fetch("/api/reports/outcome?period=month")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && typeof data.conversionRate === "number") {
          setOutcomeMetrics({
            conversionRate: data.conversionRate,
            totalSent: data.totalSent,
            totalRevisited: data.totalRevisited,
            avgDaysToRevisit: data.avgDaysToRevisit,
            byGeneratedBy: data.byGeneratedBy || {},
          });
        }
      })
      .catch(() => setOutcomeMetrics(null));
  }, []);

  const ctaStats = secondary?.ctaStats;
  const workflowSummary = secondary?.workflowSummary;
  const sourceReviewStats = secondary?.sourceReviewStats;
  const syncStats = secondary?.syncStats;
  const messageStats = secondary?.messageStats;

  return (
    <div className="space-y-6">
      {/* 제품 소개 배너 */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl p-5 text-white shadow-md">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold">CareFlow AI 환자 리콜 관리</h1>
            <p className="text-blue-100 text-sm mt-1">
              치료 중단 의심 환자 발굴 · 리콜 자동 추천 · 개인화 문자 초안 — 오늘 확인이 필요한 환자를 한눈에
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Link href="/hospital/workflow" className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              후속관리 업무
            </Link>
            <Link href="/hospital/patients" className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
              환자 목록
            </Link>
            <Link href="/about" className="px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition-colors">
              제품 소개
            </Link>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.key} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <p className="text-3xl font-bold text-gray-900">{stats[card.key]}</p>
                    <ChangeIndicator change={weeklyChanges[card.changeKey]} />
                  </div>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 부가 통계: lazy loaded */}
      {secondaryLoading ? (
        <SecondaryStatsSkeleton />
      ) : (
        <>
          {/* CPA 광고 유입 요약 */}
          {ctaStats && ctaStats.totalLeads > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-green-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-green-50">
                      <Megaphone size={18} className="text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">CPA 광고 유입</p>
                      <p className="text-xs text-gray-500">
                        유입 {ctaStats.totalLeads}건 · 확정 {ctaStats.confirmed}건 · 정산 대상 {ctaStats.settlementEligible}건 · 검토 필요 {ctaStats.pendingReview}건
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/internal/cpa"
                    className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 font-medium"
                  >
                    관리 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 업무 처리 현황 요약 */}
          {workflowSummary && workflowSummary.totalActive > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-blue-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-50">
                      <ClipboardList size={18} className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">후속관리 업무 현황</p>
                      <p className="text-xs text-gray-500">
                        미처리 {workflowSummary.unprocessed}건 · 진행 중 {workflowSummary.totalActive - workflowSummary.unprocessed}건
                        {workflowSummary.overdueFollowUps > 0 && (
                          <span className="text-red-500 font-medium"> · 기한 초과 {workflowSummary.overdueFollowUps}건</span>
                        )}
                        {workflowSummary.todayFollowUps > 0 && (
                          <span className="text-purple-500"> · 오늘 확인 {workflowSummary.todayFollowUps}건</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/hospital/workflow"
                    className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1 font-medium"
                  >
                    관리 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 유입 경로 검토 현황 */}
          {sourceReviewStats && sourceReviewStats.totalWithSource > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-purple-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-purple-50">
                      <Search size={18} className="text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">유입 경로 검토 현황</p>
                      <p className="text-xs text-gray-500">
                        검토 필요 <span className="font-medium text-amber-600">{sourceReviewStats.unreviewedCount}건</span>
                        {sourceReviewStats.unclassifiedCount > 0 && (
                          <> · 미분류 <span className="font-medium text-orange-600">{sourceReviewStats.unclassifiedCount}건</span></>
                        )}
                        {sourceReviewStats.lowConfidenceCount > 0 && (
                          <> · 저신뢰 <span className="font-medium text-red-600">{sourceReviewStats.lowConfidenceCount}건</span></>
                        )}
                        {sourceReviewStats.recentImport && (
                          <> · 최근 import: {sourceReviewStats.recentImport.fileName} ({sourceReviewStats.recentImport.count}건)</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/internal/source-review"
                    className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1 font-medium"
                  >
                    검토 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 동기화 상태 위젯 */}
          {syncStats && (
            <Card className={`border-0 shadow-sm border-l-4 ${syncStats.failedCount > 0 ? "border-l-red-400" : "border-l-cyan-400"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${syncStats.failedCount > 0 ? "bg-red-50" : "bg-cyan-50"}`}>
                      <ClipboardList size={18} className={syncStats.failedCount > 0 ? "text-red-600" : "text-cyan-600"} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">동기화 상태</p>
                      <p className="text-xs text-gray-500">
                        {syncStats.lastSync
                          ? `마지막 동기화: ${new Date(syncStats.lastSync).toLocaleString("ko-KR")}`
                          : "동기화 이력 없음"}
                        {syncStats.lastSyncStatus && (
                          <span className={`ml-1 px-1 py-0.5 rounded text-[10px] font-medium ${
                            syncStats.lastSyncStatus === "SUCCESS" ? "bg-green-50 text-green-600" :
                            syncStats.lastSyncStatus === "FAILED" ? "bg-red-50 text-red-600" :
                            "bg-amber-50 text-amber-600"
                          }`}>
                            {syncStats.lastSyncStatus === "SUCCESS" ? "성공" : syncStats.lastSyncStatus === "FAILED" ? "실패" : "부분성공"}
                          </span>
                        )}
                        {syncStats.failedCount > 0 && (
                          <span className="ml-2 font-medium text-red-600">실패 {syncStats.failedCount}건</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/internal/sync"
                    className="text-sm text-cyan-600 hover:text-cyan-700 flex items-center gap-1 font-medium"
                  >
                    관리 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 메시지 발송 현황 */}
          {messageStats && (messageStats.reviewNeeded > 0 || messageStats.failed > 0 || messageStats.sentToday > 0) && (
            <Card className={`border-0 shadow-sm border-l-4 ${messageStats.failed > 0 ? "border-l-red-400" : messageStats.reviewNeeded > 0 ? "border-l-amber-400" : "border-l-green-400"}`}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${messageStats.failed > 0 ? "bg-red-50" : messageStats.reviewNeeded > 0 ? "bg-amber-50" : "bg-green-50"}`}>
                      <Mail size={18} className={messageStats.failed > 0 ? "text-red-600" : messageStats.reviewNeeded > 0 ? "text-amber-600" : "text-green-600"} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">메시지 발송 현황</p>
                      <p className="text-xs text-gray-500">
                        {messageStats.reviewNeeded > 0 && (
                          <span className="font-medium text-amber-600">검토 필요 {messageStats.reviewNeeded}건</span>
                        )}
                        {messageStats.approved > 0 && (
                          <>{messageStats.reviewNeeded > 0 && " · "}발송 대기 {messageStats.approved}건</>
                        )}
                        {messageStats.sentToday > 0 && (
                          <>{(messageStats.reviewNeeded > 0 || messageStats.approved > 0) && " · "}<span className="text-green-600">오늘 발송 {messageStats.sentToday}건</span></>
                        )}
                        {messageStats.failed > 0 && (
                          <> · <span className="font-medium text-red-600">실패 {messageStats.failed}건</span></>
                        )}
                        {messageStats.blocked > 0 && (
                          <> · 차단 {messageStats.blocked}건</>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href="/hospital/messages"
                    className={`text-sm flex items-center gap-1 font-medium ${messageStats.failed > 0 ? "text-red-600 hover:text-red-700" : messageStats.reviewNeeded > 0 ? "text-amber-600 hover:text-amber-700" : "text-green-600 hover:text-green-700"}`}
                  >
                    관리 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI 메시지 품질 메트릭 */}
          {aiMetrics && aiMetrics.generation.totalGenerated > 0 && (
            <Card className="border-0 shadow-sm border-l-4 border-l-violet-400">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-violet-50">
                      <Sparkles size={18} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">AI 메시지 품질 (30일)</p>
                      <p className="text-xs text-gray-500">
                        생성 {aiMetrics.generation.totalGenerated}건
                        <> · AI <span className="font-medium text-violet-600">{aiMetrics.generation.byType.ai}건</span></>
                        <> · 템플릿 {aiMetrics.generation.byType.template}건</>
                        {aiMetrics.generation.byType.fallback > 0 && (
                          <> · <span className="font-medium text-amber-600">fallback {aiMetrics.generation.byType.fallback}건 ({aiMetrics.generation.fallbackRate}%)</span></>
                        )}
                        {aiMetrics.send.totalAttempted > 0 && (
                          <> · 발송 성공률 <span className={`font-medium ${aiMetrics.send.successRate >= 90 ? "text-green-600" : aiMetrics.send.successRate >= 70 ? "text-amber-600" : "text-red-600"}`}>{aiMetrics.send.successRate}%</span></>
                        )}
                        {Object.entries(aiMetrics.send.blockReasons).map(([reason, count]) => (
                          <span key={reason}> · {reason} {count}건</span>
                        ))}
                      </p>
                      {/* fallback 원인 분포 */}
                      {aiMetrics.generation.fallbackReasons && Object.keys(aiMetrics.generation.fallbackReasons).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          <span className="text-[10px] text-amber-600 font-medium">fallback 원인:</span>
                          {Object.entries(aiMetrics.generation.fallbackReasons).map(([reason, count]) => (
                            <span key={reason} className="text-[10px] text-amber-500">
                              {FALLBACK_REASON_LABELS[reason] || reason} {count}건
                            </span>
                          ))}
                        </div>
                      )}
                      {/* subType별 품질 편차 */}
                      {aiMetrics.generation.bySubType && Object.keys(aiMetrics.generation.bySubType).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {Object.entries(aiMetrics.generation.bySubType).map(([st, m]) => (
                            <span key={st} className="text-[10px] text-gray-400">
                              {st}: AI {m.ai}/{m.total}
                              {m.fallbackRate > 0 && <span className={m.fallbackRate > 30 ? "text-red-500" : "text-amber-500"}> (fb {m.fallbackRate}%)</span>}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* 메시지 유형별 발송 현황 */}
                      {Object.keys(aiMetrics.byType.byMessageType).length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {Object.entries(aiMetrics.byType.byMessageType).map(([type, m]) => (
                            <span key={type} className="text-[10px] text-gray-400">
                              {type}: {m.sent}/{m.total}건
                              {m.blocked > 0 && <span className="text-orange-500"> (차단{m.blocked})</span>}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <Link
                    href="/hospital/reports"
                    className="text-sm text-violet-600 hover:text-violet-700 flex items-center gap-1 font-medium"
                  >
                    상세 <ChevronRight size={14} />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {/* 메시지 → 재내원 전환율 */}
          {outcomeMetrics && outcomeMetrics.totalSent > 0 && (() => {
            const om = outcomeMetrics;
            const aiData = om.byGeneratedBy?.ai;
            const tplData = om.byGeneratedBy?.template;
            const fbData = om.byGeneratedBy?.fallback;
            // AI vs 템플릿 성과 차이 요약
            const aiVsTemplate = aiData && tplData && aiData.sent >= 3 && tplData.sent >= 3
              ? aiData.rate - tplData.rate
              : null;
            // fallback 비율 경고
            const fbRatio = fbData ? Math.round((fbData.sent / om.totalSent) * 100) : 0;
            // 평균 소요일 해석
            const daysLabel = om.avgDaysToRevisit != null
              ? om.avgDaysToRevisit <= 7 ? "빠른 반응" : om.avgDaysToRevisit <= 14 ? "보통" : "느린 편"
              : null;

            return (
              <Card className="border-0 shadow-sm border-l-4 border-l-emerald-400">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-emerald-50">
                        <TrendingUp size={18} className="text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">메시지 → 재내원 전환 (이번 달)</p>
                        <p className="text-xs text-gray-500">
                          전환율 <span className={`font-bold ${om.conversionRate >= 20 ? "text-emerald-600" : om.conversionRate >= 10 ? "text-amber-600" : "text-red-600"}`}>{om.conversionRate}%</span>
                          <> · 재내원 <span className="font-medium text-emerald-600">{om.totalRevisited}명</span></>
                          <> · 발송 {om.totalSent}건</>
                          {om.avgDaysToRevisit != null && (
                            <> · 평균 {om.avgDaysToRevisit}일 소요 <span className="text-gray-400">({daysLabel})</span></>
                          )}
                        </p>
                        {/* 운영 해석 보조 문구 */}
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {aiVsTemplate !== null && (
                            <span className={`text-[10px] ${aiVsTemplate > 0 ? "text-emerald-600" : aiVsTemplate < 0 ? "text-amber-600" : "text-gray-400"}`}>
                              AI {aiData!.rate}% vs 템플릿 {tplData!.rate}%
                              {aiVsTemplate > 0 ? ` (AI +${aiVsTemplate}%p)` : aiVsTemplate < 0 ? ` (템플릿 +${Math.abs(aiVsTemplate)}%p)` : " (동일)"}
                            </span>
                          )}
                          {fbRatio >= 30 && (
                            <span className="text-[10px] text-red-500 font-medium">
                              기본 메시지 비율 {fbRatio}% — AI 설정 확인 권장
                            </span>
                          )}
                          {fbRatio > 0 && fbRatio < 30 && fbData && (
                            <span className="text-[10px] text-gray-400">
                              기본 메시지 {fbData.sent}건 ({fbRatio}%)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Link
                      href="/hospital/reports"
                      className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium"
                    >
                      상세 <ChevronRight size={14} />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })()}
        </>
      )}

      {/* Urgent Contact Section */}
      {urgentPatients.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <PhoneCall size={18} />
              오늘 바로 연락 권장
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                {urgentPatients.length}명
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {urgentPatients.map((p) => (
                <Link
                  key={p.patientId}
                  href={`/patients/${p.patientId}`}
                  className="block p-3 bg-red-50/50 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900">{p.patientName}</span>
                      {p.isVip && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                    </div>
                    <ScoreTooltip score={p.priorityScore} factors={p.scoreFactors} />
                  </div>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {p.detections.slice(0, 2).map((d, i) => (
                      <Badge key={i} variant="outline" className={`text-[10px] ${getRuleColor(d.ruleType)}`}>
                        {SUB_TYPE_LABELS[d.subType as SubType] || d.subType}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 truncate">{p.detections[0]?.reason}</p>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Priority Patient List */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">우선순위 환자 리스트</CardTitle>
            <Link
              href="/hospital/patients"
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              전체 보기 <ChevronRight size={14} />
            </Link>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[70px] text-center">점수</TableHead>
                  <TableHead>환자</TableHead>
                  <TableHead className="hidden md:table-cell">차트번호</TableHead>
                  <TableHead>상태 태그</TableHead>
                  <TableHead className="hidden lg:table-cell">주요 사유</TableHead>
                  <TableHead className="w-[80px] text-center">액션</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priorityPatients.map((p) => (
                  <TableRow key={p.patientId} className="hover:bg-blue-50/30">
                    <TableCell className="text-center">
                      <ScoreTooltip score={p.priorityScore} factors={p.scoreFactors} />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{p.patientName}</span>
                        {p.isVip && <Star size={14} className="text-yellow-500 fill-yellow-500" />}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                      {p.chartNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.detections.map((d, i) => (
                          <Badge key={i} variant="outline" className={`text-[11px] ${getRuleColor(d.ruleType)}`}>
                            {SUB_TYPE_LABELS[d.subType as SubType] || RULE_TYPE_LABELS[d.ruleType as RuleType] || d.subType}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-600 max-w-[300px] truncate">
                      {p.detections[0]?.reason}
                    </TableCell>
                    <TableCell className="text-center">
                      <Link
                        href={`/patients/${p.patientId}`}
                        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        상세 <ChevronRight size={14} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {priorityPatients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-gray-400">
                      현재 확인이 필요한 환자가 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 재내원 성과 바로가기 */}
      <Card>
        <CardContent className="p-4">
          <Link
            href="/hospital/reports"
            className="flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-50">
                <BarChart3 size={18} className="text-indigo-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900">재내원 성과</p>
                <p className="text-xs text-gray-500">KPI, 퍼널, 메시지, 방문경로, 담당자별 성과를 확인하세요</p>
              </div>
            </div>
            <ChevronRight size={18} className="text-gray-400 group-hover:text-blue-600 transition-colors" />
          </Link>
        </CardContent>
      </Card>

      {/* 의료 면책 고지 */}
      <p className="text-center text-xs text-gray-400 py-2">
        CareFlow AI는 병원 운영 보조 도구이며, 의료적 판단을 대신하지 않습니다. 모든 추천은 참고용입니다.
      </p>
    </div>
  );
}
