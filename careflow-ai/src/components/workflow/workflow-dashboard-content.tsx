"use client";

import { useState, useEffect, useCallback } from "react";
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
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  AlertCircle,
  CheckCircle2,
  Clock,
  CalendarClock,
  ChevronRight,
  Star,
  Filter,
  Inbox,
  ArrowLeft,
  UserCheck,
  Pause,
  Ban,
  PhoneCall,
  ShieldAlert,
  Copy,
  RotateCcw,
  Loader2,
  Mail,
} from "lucide-react";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_COLORS,
  STAFF_ROLE_LABELS,
  SUB_TYPE_LABELS,
  type TaskStatus,
  type ActionType,
  type StaffRole,
  type SubType,
} from "@/types";

interface TaskItem {
  id: string;
  patientId: string;
  actionType: string;
  status: string;
  assigneeId: string | null;
  note: string | null;
  reason: string | null;
  nextFollowUpAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  assigneeName: string | null;
  assigneeRole: string | null;
}

interface StaffItem {
  id: string;
  name: string;
  role: string;
}

interface Summary {
  statusCounts: Record<string, number>;
  followUps: { today: number; week: number; overdue: number };
  totalActive: number;
}

interface PriorityPatient {
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  topPriority: number;
  priorityScore: number;
  detections: { ruleType: string; subType: string; priority: number; reason: string }[];
}

interface BlockedMessage {
  id: string;
  patientName: string;
  chartNumber: string;
  messageType: string;
  sendStatus: string;
  failureReason: string | null;
  duplicateBlocked: boolean;
  duplicateReason: string | null;
  doNotContactBlocked: boolean;
  createdAt: string;
}

interface Props {
  tasks: TaskItem[];
  staff: StaffItem[];
  summary: Summary;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function getRuleColor(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout": return "bg-red-100 text-red-700 border-red-200";
    case "scaling_recall": return "bg-amber-100 text-amber-700 border-amber-200";
    case "implant_followup": return "bg-blue-100 text-blue-700 border-blue-200";
    case "potential_demand": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

const statusIcons: Record<string, typeof CheckCircle2> = {
  unprocessed: Inbox,
  reviewing: Clock,
  waiting_contact: CalendarClock,
  on_hold: Pause,
  excluded: Ban,
  completed: CheckCircle2,
  recheck_scheduled: CalendarClock,
};

export function WorkflowDashboardContent({ tasks, staff, summary }: Props) {
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("");
  const [actionTypeFilter, setActionTypeFilter] = useState<string>("");
  const [priorityPatients, setPriorityPatients] = useState<PriorityPatient[]>([]);
  const [blockedMessages, setBlockedMessages] = useState<BlockedMessage[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // 오늘 연락할 환자 + 차단 메시지 가져오기
  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((data) => {
        if (data.priorityPatients) {
          setPriorityPatients(data.priorityPatients.slice(0, 10));
        }
      })
      .catch(() => {});

    fetch("/api/outbound?sendStatus=BLOCKED&limit=20")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setBlockedMessages(data);
        }
      })
      .catch(() => {});
  }, []);

  const handleBlockAction = useCallback(async (msgId: string, action: "retry" | "cancel") => {
    setActionLoading(msgId);
    try {
      const res = await fetch(`/api/outbound/${msgId}/${action}`, { method: "POST" });
      if (res.ok) {
        setBlockedMessages((prev) => prev.filter((m) => m.id !== msgId));
      }
    } catch {
      // 실패 시 무시
    } finally {
      setActionLoading(null);
    }
  }, []);

  const filteredTasks = tasks.filter((t) => {
    if (statusFilter === "active" && (t.status === "completed" || t.status === "excluded")) return false;
    if (statusFilter !== "active" && statusFilter && t.status !== statusFilter) return false;
    if (assigneeFilter && t.assigneeId !== assigneeFilter) return false;
    if (actionTypeFilter && t.actionType !== actionTypeFilter) return false;
    return true;
  });

  const kpiCards = [
    {
      label: "오늘 처리할 업무",
      value: summary.statusCounts.unprocessed + (summary.followUps.overdue || 0),
      icon: AlertCircle,
      color: "text-red-600",
      bg: "bg-red-50",
    },
    {
      label: "진행 중",
      value: summary.statusCounts.reviewing + summary.statusCounts.waiting_contact,
      icon: Clock,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "보류/재확인",
      value: summary.statusCounts.on_hold + summary.statusCounts.recheck_scheduled,
      icon: Pause,
      color: "text-orange-600",
      bg: "bg-orange-50",
    },
    {
      label: "이번 주 재확인",
      value: summary.followUps.week,
      icon: CalendarClock,
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <ClipboardList size={22} className="text-blue-600" />
              후속관리 업무
            </h1>
            <p className="text-sm text-gray-500">전체 {summary.totalActive}건 미처리 · 완료 {summary.statusCounts.completed}건</p>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`p-2.5 rounded-xl ${card.bg}`}>
                  <card.icon size={20} className={card.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 기한 초과 알림 */}
      {summary.followUps.overdue > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-sm font-medium text-red-700">
                확인일이 지난 업무가 {summary.followUps.overdue}건 있습니다
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 오늘 연락할 환자 */}
      {priorityPatients.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-red-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-red-700">
              <PhoneCall size={18} />
              오늘 연락 권장
              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                {priorityPatients.length}명
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {priorityPatients.map((p) => (
                <Link
                  key={p.patientId}
                  href={`/patients/${p.patientId}`}
                  className="block p-3 bg-red-50/50 rounded-lg hover:bg-red-50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-gray-900 text-sm">{p.patientName}</span>
                      {p.isVip && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                    </div>
                    <span className={`text-xs font-bold ${p.priorityScore >= 50 ? "text-red-600" : p.priorityScore >= 30 ? "text-amber-600" : "text-blue-600"}`}>
                      {p.priorityScore}점
                    </span>
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

      {/* 차단된 메시지 — 즉시 액션 */}
      {blockedMessages.length > 0 && (
        <Card className="border-0 shadow-sm border-l-4 border-l-orange-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-orange-700">
              <ShieldAlert size={18} />
              발송 차단 메시지
              <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">
                {blockedMessages.length}건
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {blockedMessages.map((m) => {
              const isDoNotContact = m.doNotContactBlocked;
              const isDuplicate = m.duplicateBlocked;
              const reason = isDoNotContact
                ? "수신거부"
                : isDuplicate && m.duplicateReason
                  ? m.duplicateReason
                  : m.failureReason || "차단됨";

              return (
                <div key={m.id} className="flex items-center justify-between gap-3 p-3 bg-orange-50/50 rounded-lg">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <div className="shrink-0">
                      {isDoNotContact ? (
                        <Ban size={16} className="text-red-500" />
                      ) : (
                        <Copy size={16} className="text-orange-500" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">{m.patientName}</span>
                        <span className="text-[10px] text-gray-400">{m.chartNumber}</span>
                      </div>
                      <p className="text-xs text-orange-600 truncate">{reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!isDoNotContact && (
                      <button
                        onClick={() => handleBlockAction(m.id, "retry")}
                        disabled={actionLoading === m.id}
                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                      >
                        {actionLoading === m.id ? <Loader2 size={10} className="animate-spin" /> : <RotateCcw size={10} />}
                        재시도
                      </button>
                    )}
                    <button
                      onClick={() => handleBlockAction(m.id, "cancel")}
                      disabled={actionLoading === m.id}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                    >
                      <Ban size={10} />
                      제외
                    </button>
                    <Link
                      href="/messages"
                      className="flex items-center gap-1 px-2.5 py-1 text-xs text-gray-400 hover:text-gray-600"
                    >
                      <Mail size={10} />
                    </Link>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* 필터 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={14} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="border rounded-lg px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="active">미완료 업무</option>
              <option value="">전체</option>
              {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={actionTypeFilter}
              onChange={(e) => setActionTypeFilter(e.target.value)}
              className="border rounded-lg px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">모든 유형</option>
              {Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <select
              value={assigneeFilter}
              onChange={(e) => setAssigneeFilter(e.target.value)}
              className="border rounded-lg px-2.5 py-1.5 text-sm bg-white"
            >
              <option value="">모든 담당자</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>{STAFF_ROLE_LABELS[s.role as StaffRole] || ""} {s.name}</option>
              ))}
            </select>
            <span className="text-xs text-gray-400 ml-auto">{filteredTasks.length}건</span>
          </div>
        </CardContent>
      </Card>

      {/* 업무 목록 테이블 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[100px]">상태</TableHead>
                  <TableHead>유형</TableHead>
                  <TableHead>환자</TableHead>
                  <TableHead className="hidden md:table-cell">담당자</TableHead>
                  <TableHead className="hidden lg:table-cell">메모</TableHead>
                  <TableHead className="hidden md:table-cell">확인일</TableHead>
                  <TableHead className="w-[70px] text-center">상세</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      해당하는 업무가 없습니다
                    </TableCell>
                  </TableRow>
                )}
                {filteredTasks.map((t) => {
                  const StatusIcon = statusIcons[t.status] || Clock;
                  const isOverdue = t.nextFollowUpAt && new Date(t.nextFollowUpAt) < new Date() && t.status !== "completed" && t.status !== "excluded";

                  return (
                    <TableRow key={t.id} className={`hover:bg-blue-50/30 ${isOverdue ? "bg-red-50/30" : ""}`}>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${TASK_STATUS_COLORS[t.status as TaskStatus] || ""}`}>
                          {TASK_STATUS_LABELS[t.status as TaskStatus] || t.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${ACTION_TYPE_COLORS[t.actionType as ActionType] || ""}`}>
                          {ACTION_TYPE_LABELS[t.actionType as ActionType] || t.actionType}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900 text-sm">{t.patientName}</span>
                          {t.isVip && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                        </div>
                        <span className="text-xs text-gray-400">{t.chartNumber}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.assigneeName ? (
                          <span className="text-sm text-gray-600 flex items-center gap-1">
                            <UserCheck size={12} className="text-gray-400" />
                            {t.assigneeName}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">미지정</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {t.note ? (
                          <span className="text-sm text-gray-600 truncate max-w-[200px] block">{t.note}</span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {t.nextFollowUpAt ? (
                          <span className={`text-sm flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : "text-gray-600"}`}>
                            <CalendarClock size={12} />
                            {formatDate(t.nextFollowUpAt)}
                            {isOverdue && <span className="text-[10px]">지남</span>}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Link
                          href={`/patients/${t.patientId}`}
                          className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700"
                        >
                          <ChevronRight size={14} />
                        </Link>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* 상태별 요약 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
        {Object.entries(TASK_STATUS_LABELS).map(([key, label]) => {
          const count = summary.statusCounts[key] || 0;
          return (
            <button
              key={key}
              onClick={() => setStatusFilter(key)}
              className={`p-3 rounded-lg border text-center transition-colors ${statusFilter === key ? "border-blue-400 bg-blue-50" : "border-gray-100 hover:bg-gray-50"}`}
            >
              <p className="text-lg font-bold text-gray-900">{count}</p>
              <p className="text-xs text-gray-500">{label}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
