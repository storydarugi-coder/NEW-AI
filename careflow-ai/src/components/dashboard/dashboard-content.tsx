"use client";

import { useState } from "react";
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
// Custom tooltip instead of shadcn tooltip (base-ui compatibility)
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
  ctaStats?: {
    totalLeads: number;
    pendingReview: number;
    confirmed: number;
  };
}

const statCards = [
  { key: "todayActionCount" as const, changeKey: "todayAction" as const, label: "오늘 확인할 환자", icon: Users, color: "text-blue-600", bg: "bg-blue-50" },
  { key: "treatmentDropoutCount" as const, changeKey: "treatmentDropout" as const, label: "치료 중단 의심", icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
  { key: "recallDueCount" as const, changeKey: "recallDue" as const, label: "리콜 예정", icon: CalendarClock, color: "text-amber-600", bg: "bg-amber-50" },
  { key: "messageSuggestionCount" as const, changeKey: "messageSuggestion" as const, label: "문자 발송 추천", icon: MessageSquare, color: "text-green-600", bg: "bg-green-50" },
];

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

export function DashboardContent({
  stats,
  weeklyChanges,
  urgentPatients,
  priorityPatients,
  ctaStats,
}: DashboardContentProps) {
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
            <Link href="/patients" className="px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors">
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

      {/* CTA 광고 유입 요약 */}
      {ctaStats && ctaStats.totalLeads > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-green-400">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-50">
                  <Megaphone size={18} className="text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">CTA 광고 유입</p>
                  <p className="text-xs text-gray-500">
                    이번 달 {ctaStats.totalLeads}건 · 확정 {ctaStats.confirmed}건 · 검토 대기 {ctaStats.pendingReview}건
                  </p>
                </div>
              </div>
              <Link
                href="/cta"
                className="text-sm text-green-600 hover:text-green-700 flex items-center gap-1 font-medium"
              >
                관리 <ChevronRight size={14} />
              </Link>
            </div>
          </CardContent>
        </Card>
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
              href="/patients"
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

      {/* 의료 면책 고지 */}
      <p className="text-center text-xs text-gray-400 py-2">
        ⚕️ CareFlow AI는 병원 운영 보조 도구이며, 의료적 판단을 대신하지 않습니다. 모든 추천은 참고용입니다.
      </p>
    </div>
  );
}
