"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Send,
  RotateCcw,
  Ban,
  Eye,
  X,
  Loader2,
  RefreshCw,
  Mail,
  ShieldAlert,
  Copy,
  ChevronDown,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

interface OutboundItem {
  id: string;
  patientId: string;
  patientName: string;
  chartNumber: string;
  doNotContact: boolean;
  messageType: string;
  channel: string;
  draftMessage: string;
  finalMessage: string | null;
  approvalStatus: string;
  approvalMemo: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  sendStatus: string;
  scheduledAt: string | null;
  sentAt: string | null;
  failedAt: string | null;
  failureReason: string | null;
  sendAttemptCount: number;
  duplicateBlocked: boolean;
  duplicateReason: string | null;
  doNotContactBlocked: boolean;
  createdBy: string;
  sentBy: string | null;
  createdAt: string;
}

interface Stats {
  reviewNeeded: number;
  approved: number;
  scheduledToday: number;
  sentToday: number;
  failed: number;
  retryNeeded: number;
  blocked: number;
  totalSent: number;
}

const TYPE_LABELS: Record<string, string> = {
  RECALL: "리콜 안내",
  CTA_FOLLOWUP: "CPA 후속",
  TREATMENT_RESUME: "치료 복귀 유도",
  COUNSELING_FOLLOWUP: "상담 후속",
  SCALING_REMINDER: "스케일링 안내",
  GENERAL: "일반 안내",
};

const APPROVAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  DRAFT: { label: "초안", color: "text-gray-600", bg: "bg-gray-100" },
  REVIEW_NEEDED: { label: "검토 필요", color: "text-amber-700", bg: "bg-amber-100" },
  APPROVED: { label: "승인됨", color: "text-green-700", bg: "bg-green-100" },
  REJECTED: { label: "반려", color: "text-red-700", bg: "bg-red-100" },
};

const SEND_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  PENDING: { label: "대기", color: "text-gray-600", bg: "bg-gray-100" },
  SCHEDULED: { label: "예약", color: "text-blue-700", bg: "bg-blue-100" },
  SENDING: { label: "발송중", color: "text-blue-700", bg: "bg-blue-100" },
  SENT: { label: "발송완료", color: "text-green-700", bg: "bg-green-100" },
  FAILED: { label: "실패", color: "text-red-700", bg: "bg-red-100" },
  RETRY_NEEDED: { label: "재시도필요", color: "text-amber-700", bg: "bg-amber-100" },
  CANCELLED: { label: "취소", color: "text-gray-500", bg: "bg-gray-100" },
  BLOCKED: { label: "차단", color: "text-red-700", bg: "bg-red-100" },
};

type ViewFilter = "all" | "review" | "ready" | "scheduled" | "sent" | "failed" | "blocked";

export function MessagesContent() {
  const { user } = useAuth();
  const [items, setItems] = useState<OutboundItem[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ViewFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [editMessage, setEditMessage] = useState("");
  const [rejectReason, setRejectReason] = useState("");

  const loadData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter === "review") params.set("approvalStatus", "REVIEW_NEEDED");
      else if (filter === "ready") { params.set("approvalStatus", "APPROVED"); params.set("sendStatus", "PENDING"); }
      else if (filter === "scheduled") params.set("sendStatus", "SCHEDULED");
      else if (filter === "sent") params.set("sendStatus", "SENT");
      else if (filter === "failed") params.set("sendStatus", "FAILED");
      else if (filter === "blocked") params.set("sendStatus", "BLOCKED");

      const [msgRes, statRes] = await Promise.all([
        fetch(`/api/outbound?${params}`),
        fetch("/api/outbound/stats"),
      ]);
      if (msgRes.ok) {
        const data = await msgRes.json();
        setItems(data.items);
      }
      if (statRes.ok) {
        setStats(await statRes.json());
      }
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { loadData(); }, [loadData]);

  const doAction = async (id: string, endpoint: string, body?: Record<string, unknown>) => {
    setActionLoading(id);
    try {
      const res = await fetch(`/api/outbound/${id}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : "{}",
      });
      const data = await res.json();
      if (!res.ok) alert(data.error || "처리 실패");
      loadData();
      setSelectedId(null);
    } catch { alert("오류 발생"); } finally {
      setActionLoading(null);
    }
  };

  const selected = items.find((i) => i.id === selectedId);

  const filterTabs: { key: ViewFilter; label: string; count?: number }[] = [
    { key: "all", label: "전체" },
    { key: "review", label: "검토 필요", count: stats?.reviewNeeded },
    { key: "ready", label: "발송 대기", count: stats?.approved },
    { key: "scheduled", label: "예약", count: stats?.scheduledToday },
    { key: "sent", label: "발송완료", count: stats?.sentToday },
    { key: "failed", label: "실패/재시도", count: (stats?.failed || 0) + (stats?.retryNeeded || 0) },
    { key: "blocked", label: "차단", count: stats?.blocked },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400">
        <Loader2 className="animate-spin mr-2" size={20} />
        메시지 로딩 중...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">리콜/후속 메시지</h1>
          <p className="text-sm text-gray-500 mt-1">재내원 유도 · 후속관리 메시지 검토 · 승인 · 발송</p>
        </div>
        <button onClick={loadData} className="flex items-center gap-2 px-3 py-2 text-sm bg-white border rounded-lg hover:bg-gray-50">
          <RefreshCw size={14} /> 새로고침
        </button>
      </div>

      {/* 통계 카드 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Eye size={14} className="text-amber-500" />
              <p className="text-xs text-amber-600">검토 필요</p>
            </div>
            <p className="text-2xl font-bold text-amber-600">{stats.reviewNeeded}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Send size={14} className="text-blue-500" />
              <p className="text-xs text-blue-600">오늘 발송</p>
            </div>
            <p className="text-2xl font-bold text-blue-600">{stats.sentToday}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={14} className="text-red-500" />
              <p className="text-xs text-red-600">실패/재시도</p>
            </div>
            <p className="text-2xl font-bold text-red-600">{stats.failed + stats.retryNeeded}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 size={14} className="text-green-500" />
              <p className="text-xs text-green-600">누적 발송</p>
            </div>
            <p className="text-2xl font-bold text-green-600">{stats.totalSent}</p>
          </div>
        </div>
      )}

      {/* 필터 탭 */}
      <div className="flex gap-1 bg-white rounded-xl border p-1 overflow-x-auto">
        {filterTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
              filter === tab.key ? "bg-blue-50 text-blue-700" : "text-gray-500 hover:bg-gray-50"
            }`}
          >
            {tab.label}
            {tab.count !== undefined && tab.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-white rounded text-[10px]">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* 메시지 목록 */}
      <div className="bg-white rounded-xl border">
        {items.length === 0 ? (
          <div className="p-8 text-center text-gray-400 text-sm">
            <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
            해당 조건의 메시지가 없습니다.
          </div>
        ) : (
          <div className="divide-y">
            {items.map((item) => {
              const ac = APPROVAL_CONFIG[item.approvalStatus] || APPROVAL_CONFIG.DRAFT;
              const sc = SEND_CONFIG[item.sendStatus] || SEND_CONFIG.PENDING;
              return (
                <div key={item.id} className="p-4 hover:bg-gray-50/50">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-900">{item.patientName}</span>
                        <span className="text-xs text-gray-400">{item.chartNumber}</span>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600">
                          {TYPE_LABELS[item.messageType] || item.messageType}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ac.bg} ${ac.color}`}>
                          {ac.label}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${sc.bg} ${sc.color}`}>
                          {sc.label}
                        </span>
                        {item.doNotContact && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-50 text-red-600">
                            <Ban size={10} className="inline mr-0.5" />수신거부
                          </span>
                        )}
                        {item.duplicateBlocked && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-50 text-orange-600">
                            <Copy size={10} className="inline mr-0.5" />중복차단
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {item.finalMessage || item.draftMessage}
                      </p>
                      <div className="flex items-center gap-3 mt-1.5 text-[10px] text-gray-400">
                        <span>생성: {item.createdBy}</span>
                        {item.approvedBy && <span>승인: {item.approvedBy}</span>}
                        {item.sentBy && <span>발송: {item.sentBy}</span>}
                        {item.sentAt && <span>발송일: {new Date(item.sentAt).toLocaleString("ko-KR")}</span>}
                        {item.failureReason && (
                          <span className="text-red-500">실패: {item.failureReason}</span>
                        )}
                        {item.sendAttemptCount > 1 && (
                          <span className="text-amber-500">시도: {item.sendAttemptCount}회</span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedId(selectedId === item.id ? null : item.id);
                        setEditMessage(item.finalMessage || item.draftMessage);
                        setRejectReason("");
                      }}
                      className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                    >
                      <ChevronDown size={16} className={selectedId === item.id ? "rotate-180" : ""} />
                    </button>
                  </div>

                  {/* 확장 상세 */}
                  {selectedId === item.id && selected && (
                    <div className="mt-3 pt-3 border-t space-y-3">
                      {/* 메시지 내용 */}
                      <div className="bg-gray-50 rounded-lg p-3">
                        <p className="text-[10px] text-gray-400 mb-1">메시지 내용</p>
                        {item.approvalStatus === "REVIEW_NEEDED" ? (
                          <textarea
                            value={editMessage}
                            onChange={(e) => setEditMessage(e.target.value)}
                            className="w-full text-sm p-2 border rounded-lg resize-none"
                            rows={4}
                          />
                        ) : (
                          <p className="text-sm text-gray-700 whitespace-pre-wrap">
                            {item.finalMessage || item.draftMessage}
                          </p>
                        )}
                      </div>

                      {/* 경고 */}
                      {item.doNotContact && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                          <ShieldAlert size={14} /> 수신 거부 환자 — 발송이 차단됩니다
                        </div>
                      )}
                      {item.failureReason && (
                        <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-xs text-red-700">
                          <XCircle size={14} /> {item.failureReason}
                        </div>
                      )}

                      {/* 반려 사유 입력 */}
                      {item.approvalStatus === "REVIEW_NEEDED" && (
                        <input
                          type="text"
                          placeholder="반려 사유 (반려 시 입력)"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          className="w-full text-xs px-3 py-2 border rounded-lg"
                        />
                      )}

                      {/* 액션 버튼 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {item.approvalStatus === "REVIEW_NEEDED" && (
                          <>
                            <button
                              onClick={() => doAction(item.id, "approve", { action: "approve", finalMessage: editMessage })}
                              disabled={actionLoading === item.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-green-50 text-green-700 rounded-lg hover:bg-green-100 disabled:opacity-50"
                            >
                              <CheckCircle2 size={12} /> 승인
                            </button>
                            <button
                              onClick={() => doAction(item.id, "approve", { action: "reject", rejectedReason: rejectReason || "반려" })}
                              disabled={actionLoading === item.id}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-red-50 text-red-700 rounded-lg hover:bg-red-100 disabled:opacity-50"
                            >
                              <XCircle size={12} /> 반려
                            </button>
                          </>
                        )}
                        {item.approvalStatus === "APPROVED" && ["PENDING", "SCHEDULED"].includes(item.sendStatus) && (
                          <button
                            onClick={() => doAction(item.id, "send")}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 disabled:opacity-50"
                          >
                            {actionLoading === item.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                            발송
                          </button>
                        )}
                        {["FAILED", "RETRY_NEEDED"].includes(item.sendStatus) && item.sendAttemptCount < 3 && (
                          <button
                            onClick={() => doAction(item.id, "retry")}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 disabled:opacity-50"
                          >
                            <RotateCcw size={12} /> 재시도 ({item.sendAttemptCount}/3)
                          </button>
                        )}
                        {!["SENT", "CANCELLED", "BLOCKED"].includes(item.sendStatus) && (
                          <button
                            onClick={() => doAction(item.id, "cancel")}
                            disabled={actionLoading === item.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-50"
                          >
                            <X size={12} /> 취소
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
