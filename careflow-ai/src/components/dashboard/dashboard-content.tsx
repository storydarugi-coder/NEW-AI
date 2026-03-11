"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
} from "lucide-react";
import {
  RULE_TYPE_LABELS,
  SUB_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type RuleType,
  type SubType,
  type Priority,
} from "@/types";

interface Detection {
  ruleType: string;
  subType: string;
  priority: number;
  reason: string;
}

interface PriorityPatient {
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  topPriority: number;
  lastVisitDate: string | null;
  detections: Detection[];
}

interface DashboardContentProps {
  stats: {
    todayActionCount: number;
    treatmentDropoutCount: number;
    recallDueCount: number;
    messageSuggestionCount: number;
  };
  priorityPatients: PriorityPatient[];
}

const statCards = [
  {
    key: "todayActionCount" as const,
    label: "오늘 확인할 환자",
    icon: Users,
    color: "text-blue-600",
    bg: "bg-blue-50",
  },
  {
    key: "treatmentDropoutCount" as const,
    label: "치료 중단 의심",
    icon: AlertTriangle,
    color: "text-red-600",
    bg: "bg-red-50",
  },
  {
    key: "recallDueCount" as const,
    label: "리콜 예정",
    icon: CalendarClock,
    color: "text-amber-600",
    bg: "bg-amber-50",
  },
  {
    key: "messageSuggestionCount" as const,
    label: "문자 발송 추천",
    icon: MessageSquare,
    color: "text-green-600",
    bg: "bg-green-50",
  },
];

function getRuleColor(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout":
      return "bg-red-100 text-red-700 border-red-200";
    case "scaling_recall":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "implant_followup":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "potential_demand":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function DashboardContent({ stats, priorityPatients }: DashboardContentProps) {
  return (
    <div className="space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
        <p className="text-sm text-gray-500 mt-1">
          오늘의 환자 관리 현황을 한눈에 확인하세요
        </p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => (
          <Card key={card.key} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">
                    {stats[card.key]}
                  </p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

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
                  <TableHead className="w-[60px] text-center">우선순위</TableHead>
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
                      <Badge
                        variant="outline"
                        className={PRIORITY_COLORS[p.topPriority as Priority]}
                      >
                        {PRIORITY_LABELS[p.topPriority as Priority]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">
                          {p.patientName}
                        </span>
                        {p.isVip && (
                          <Star
                            size={14}
                            className="text-yellow-500 fill-yellow-500"
                          />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-gray-500 text-sm">
                      {p.chartNumber}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.detections.map((d, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={`text-[11px] ${getRuleColor(d.ruleType)}`}
                          >
                            {SUB_TYPE_LABELS[d.subType as SubType] ||
                              RULE_TYPE_LABELS[d.ruleType as RuleType] ||
                              d.subType}
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
                        상세
                        <ChevronRight size={14} />
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
    </div>
  );
}
