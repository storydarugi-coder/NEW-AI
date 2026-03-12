"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList,
  UserCheck,
  CalendarClock,
  StickyNote,
  CheckCircle2,
  Pause,
  Ban,
  Eye,
  PhoneCall,
  RotateCcw,
  Plus,
  Clock,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  TASK_STATUS_LABELS,
  TASK_STATUS_COLORS,
  ACTION_TYPE_LABELS,
  ACTION_TYPE_COLORS,
  STAFF_ROLE_LABELS,
  type TaskStatus,
  type ActionType,
  type StaffRole,
} from "@/types";

interface StaffItem {
  id: string;
  name: string;
  role: string;
}

interface ActivityItem {
  id: string;
  action: string;
  fromValue: string | null;
  toValue: string | null;
  detail: string | null;
  createdAt: string;
  staff?: { name: string } | null;
}

interface TaskItem {
  id: string;
  actionType: string;
  status: string;
  assigneeId: string | null;
  note: string | null;
  reason: string | null;
  nextFollowUpAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: StaffItem | null;
  activities: ActivityItem[];
}

interface Props {
  patientId: string;
  patientName: string;
  initialTasks: TaskItem[];
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  const date = new Date(d);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, "0")}.${String(date.getDate()).padStart(2, "0")}`;
}

function formatDateTime(d: string): string {
  const date = new Date(d);
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

const statusActions: { status: TaskStatus; label: string; icon: typeof CheckCircle2; needsReason: boolean }[] = [
  { status: "reviewing", label: "검토 시작", icon: Eye, needsReason: false },
  { status: "waiting_contact", label: "연락 대기", icon: PhoneCall, needsReason: false },
  { status: "on_hold", label: "보류", icon: Pause, needsReason: true },
  { status: "excluded", label: "제외", icon: Ban, needsReason: true },
  { status: "completed", label: "완료", icon: CheckCircle2, needsReason: true },
  { status: "recheck_scheduled", label: "재확인 예정", icon: RotateCcw, needsReason: false },
];

const activityLabels: Record<string, string> = {
  task_created: "업무 생성",
  status_change: "상태 변경",
  assignee_change: "담당자 변경",
  note_added: "메모 추가",
  followup_set: "확인일 설정",
};

export function TaskPanel({ patientId, patientName, initialTasks }: Props) {
  const [tasks, setTasks] = useState<TaskItem[]>(initialTasks);
  const [staffList, setStaffList] = useState<StaffItem[]>([]);
  const [showNewTask, setShowNewTask] = useState(false);
  const [newActionType, setNewActionType] = useState<ActionType>("GENERAL");
  const [saving, setSaving] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(tasks[0]?.id || null);

  // 상태 변경 모달 state
  const [statusModal, setStatusModal] = useState<{ taskId: string; status: TaskStatus } | null>(null);
  const [modalReason, setModalReason] = useState("");

  // 메모 입력
  const [noteInput, setNoteInput] = useState<Record<string, string>>({});
  // 확인일 입력
  const [followUpInput, setFollowUpInput] = useState<Record<string, string>>({});
  // 담당자 변경
  const [assigneeSelect, setAssigneeSelect] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch("/api/staff").then((r) => r.json()).then(setStaffList).catch(() => {});
  }, []);

  async function createTask() {
    setSaving(true);
    try {
      const res = await fetch("/api/workflow/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patientId, actionType: newActionType }),
      });
      if (res.ok) {
        const task = await res.json();
        setTasks((prev) => [{ ...task, activities: [] }, ...prev]);
        setShowNewTask(false);
        setExpandedTask(task.id);
      }
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId: string, data: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch(`/api/workflow/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const updated = await res.json();
        setTasks((prev) => prev.map((t) => (t.id === taskId ? updated : t)));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(taskId: string, newStatus: TaskStatus) {
    const action = statusActions.find((a) => a.status === newStatus);
    if (action?.needsReason) {
      setStatusModal({ taskId, status: newStatus });
      setModalReason("");
      return;
    }
    await updateTask(taskId, { status: newStatus });
  }

  async function confirmStatusChange() {
    if (!statusModal) return;
    await updateTask(statusModal.taskId, {
      status: statusModal.status,
      reason: modalReason || undefined,
    });
    setStatusModal(null);
    setModalReason("");
  }

  async function saveNote(taskId: string) {
    const note = noteInput[taskId];
    if (!note?.trim()) return;
    await updateTask(taskId, { note: note.trim() });
    setNoteInput((prev) => ({ ...prev, [taskId]: "" }));
  }

  async function saveFollowUp(taskId: string) {
    const date = followUpInput[taskId];
    if (!date) return;
    await updateTask(taskId, { nextFollowUpAt: date, status: "recheck_scheduled" });
    setFollowUpInput((prev) => ({ ...prev, [taskId]: "" }));
  }

  async function changeAssignee(taskId: string) {
    const assigneeId = assigneeSelect[taskId];
    await updateTask(taskId, { assigneeId: assigneeId || null });
  }

  return (
    <div className="space-y-3">
      {/* 상태 변경 사유 모달 */}
      {statusModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setStatusModal(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-bold text-gray-900 mb-3">
              {TASK_STATUS_LABELS[statusModal.status]} 처리 사유
            </h3>
            <textarea
              value={modalReason}
              onChange={(e) => setModalReason(e.target.value)}
              placeholder="사유를 입력하세요 (선택)"
              className="w-full border rounded-lg p-3 text-sm resize-none h-24 focus:ring-2 focus:ring-blue-400 focus:border-transparent outline-none"
            />
            <div className="flex gap-2 mt-3 justify-end">
              <Button variant="outline" size="sm" onClick={() => setStatusModal(null)}>취소</Button>
              <Button size="sm" onClick={confirmStatusChange} disabled={saving}>확인</Button>
            </div>
          </div>
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-blue-600" />
          <span className="font-medium text-gray-900 text-sm">업무 처리</span>
          <Badge variant="outline" className="text-[11px]">{tasks.length}건</Badge>
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowNewTask(!showNewTask)} className="text-xs gap-1">
          <Plus size={12} /> 업무 추가
        </Button>
      </div>

      {/* 새 업무 추가 폼 */}
      {showNewTask && (
        <Card className="border-blue-200 bg-blue-50/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-gray-700">새 업무 만들기</p>
            <select
              value={newActionType}
              onChange={(e) => setNewActionType(e.target.value as ActionType)}
              className="w-full border rounded-lg px-3 py-2 text-sm bg-white"
            >
              {Object.entries(ACTION_TYPE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <div className="flex gap-2">
              <Button size="sm" onClick={createTask} disabled={saving} className="text-xs">생성</Button>
              <Button variant="outline" size="sm" onClick={() => setShowNewTask(false)} className="text-xs">취소</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 업무 없음 */}
      {tasks.length === 0 && !showNewTask && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center text-gray-400 text-sm">
            등록된 업무가 없습니다. 위 버튼으로 업무를 추가하세요.
          </CardContent>
        </Card>
      )}

      {/* 업무 목록 */}
      {tasks.map((task) => {
        const isExpanded = expandedTask === task.id;
        const isTerminal = task.status === "completed" || task.status === "excluded";

        return (
          <Card key={task.id} className={`border-0 shadow-sm ${isTerminal ? "opacity-70" : ""}`}>
            <CardHeader className="pb-0 pt-4 px-4 cursor-pointer" onClick={() => setExpandedTask(isExpanded ? null : task.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="outline" className={`text-[11px] ${ACTION_TYPE_COLORS[task.actionType as ActionType] || ""}`}>
                    {ACTION_TYPE_LABELS[task.actionType as ActionType] || task.actionType}
                  </Badge>
                  <Badge variant="outline" className={`text-[11px] ${TASK_STATUS_COLORS[task.status as TaskStatus] || ""}`}>
                    {TASK_STATUS_LABELS[task.status as TaskStatus] || task.status}
                  </Badge>
                  {task.assignee && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <UserCheck size={11} />
                      {STAFF_ROLE_LABELS[task.assignee.role as StaffRole] || ""} {task.assignee.name}
                    </span>
                  )}
                </div>
                {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
              </div>

              {/* 요약 정보 (접혀 있어도 보이는 것) */}
              <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                {task.nextFollowUpAt && (
                  <span className="flex items-center gap-1">
                    <CalendarClock size={11} />
                    {formatDate(task.nextFollowUpAt)}
                  </span>
                )}
                {task.note && (
                  <span className="flex items-center gap-1 truncate max-w-[200px]">
                    <StickyNote size={11} />
                    {task.note}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Clock size={11} />
                  {formatDate(task.createdAt)}
                </span>
              </div>
            </CardHeader>

            {isExpanded && (
              <CardContent className="px-4 pb-4 pt-3 space-y-4">
                {/* 사유 표시 */}
                {task.reason && (
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">사유</p>
                    <p className="text-sm text-gray-700">{task.reason}</p>
                  </div>
                )}

                {/* 상태 변경 버튼 */}
                {!isTerminal && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">상태 변경</p>
                    <div className="flex flex-wrap gap-1.5">
                      {statusActions
                        .filter((a) => a.status !== task.status)
                        .map((action) => (
                          <Button
                            key={action.status}
                            variant="outline"
                            size="sm"
                            className="text-xs gap-1"
                            disabled={saving}
                            onClick={() => handleStatusChange(task.id, action.status)}
                          >
                            <action.icon size={12} />
                            {action.label}
                          </Button>
                        ))}
                    </div>
                  </div>
                )}

                {/* 담당자 변경 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">담당자</p>
                  <div className="flex gap-2">
                    <select
                      value={assigneeSelect[task.id] ?? task.assigneeId ?? ""}
                      onChange={(e) => setAssigneeSelect((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm bg-white"
                    >
                      <option value="">미지정</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>
                          {STAFF_ROLE_LABELS[s.role as StaffRole] || ""} {s.name}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      disabled={saving}
                      onClick={() => changeAssignee(task.id)}
                    >
                      저장
                    </Button>
                  </div>
                </div>

                {/* 메모 입력 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">처리 메모</p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={noteInput[task.id] || ""}
                      onChange={(e) => setNoteInput((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      placeholder="예: 전화 연결 안 됨, 오후 재시도"
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                      onKeyDown={(e) => { if (e.key === "Enter") saveNote(task.id); }}
                    />
                    <Button variant="outline" size="sm" className="text-xs" disabled={saving} onClick={() => saveNote(task.id)}>
                      저장
                    </Button>
                  </div>
                </div>

                {/* 다음 확인일 */}
                <div>
                  <p className="text-xs text-gray-500 mb-1.5">다음 확인일</p>
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={followUpInput[task.id] || ""}
                      onChange={(e) => setFollowUpInput((prev) => ({ ...prev, [task.id]: e.target.value }))}
                      className="flex-1 border rounded-lg px-3 py-1.5 text-sm"
                    />
                    <Button variant="outline" size="sm" className="text-xs" disabled={saving} onClick={() => saveFollowUp(task.id)}>
                      설정
                    </Button>
                  </div>
                </div>

                {/* 활동 이력 */}
                {task.activities && task.activities.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1.5">최근 변경 이력</p>
                    <div className="space-y-1">
                      {task.activities.map((a) => (
                        <div key={a.id} className="flex items-center gap-2 text-xs text-gray-500 py-1 border-b border-gray-50 last:border-0">
                          <span className="text-gray-400">{formatDateTime(a.createdAt)}</span>
                          <span className="font-medium text-gray-600">{activityLabels[a.action] || a.action}</span>
                          {a.fromValue && a.toValue && (
                            <span>
                              {TASK_STATUS_LABELS[a.fromValue as TaskStatus] || a.fromValue} → {TASK_STATUS_LABELS[a.toValue as TaskStatus] || a.toValue}
                            </span>
                          )}
                          {!a.fromValue && a.toValue && <span>{a.toValue}</span>}
                          {a.staff && <span className="text-gray-400">({a.staff.name})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            )}
          </Card>
        );
      })}
    </div>
  );
}
