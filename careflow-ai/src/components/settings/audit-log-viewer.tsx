"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollText, Loader2, ChevronLeft, ChevronRight } from "lucide-react";

interface AuditEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  detail: Record<string, unknown> | null;
  createdAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  admin_update_user: "사용자 정보 변경",
  source_review: "유입 경로 검토",
  review_attribution: "CTA 귀속 검토",
  export_data: "데이터 내보내기",
  batch_review: "일괄 검토",
};

const ACTION_COLORS: Record<string, string> = {
  admin_update_user: "bg-indigo-50 text-indigo-700 border-indigo-200",
  source_review: "bg-blue-50 text-blue-700 border-blue-200",
  review_attribution: "bg-purple-50 text-purple-700 border-purple-200",
  export_data: "bg-amber-50 text-amber-700 border-amber-200",
};

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filter, setFilter] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "30" });
      if (filter) params.set("action", filter);
      const res = await fetch(`/api/admin/audit-logs?${params}`);
      if (!res.ok) throw new Error("조회 실패");
      const data = await res.json();
      setLogs(data.logs);
      setTotalPages(data.pagination.totalPages);
    } catch {
      setError("감사 로그를 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, [page, filter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  function formatDetail(detail: Record<string, unknown> | null): string {
    if (!detail) return "-";
    if (detail.changes) {
      const changes = detail.changes as Record<string, { from: unknown; to: unknown }>;
      return Object.entries(changes)
        .map(([k, v]) => `${k}: ${String(v.from)} → ${String(v.to)}`)
        .join(", ");
    }
    if (detail.reviewStatus) return `상태: ${String(detail.reviewStatus)}`;
    if (detail.rowCount) return `${String(detail.rowCount)}건 내보내기`;
    return JSON.stringify(detail).slice(0, 100);
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ScrollText size={18} className="text-gray-600" />
          감사 로그
        </CardTitle>
        <div className="flex gap-1.5 mt-2">
          <Button
            variant={filter === null ? "default" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => { setFilter(null); setPage(1); }}
          >
            전체
          </Button>
          {Object.entries(ACTION_LABELS).map(([key, label]) => (
            <Button
              key={key}
              variant={filter === key ? "default" : "ghost"}
              size="sm"
              className="text-xs h-7"
              onClick={() => { setFilter(key); setPage(1); }}
            >
              {label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg mb-3">{error}</div>}

        {loading ? (
          <div className="text-center py-8 text-gray-400">
            <Loader2 className="animate-spin mx-auto mb-2" size={20} />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">로그가 없습니다.</div>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0">
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 mt-0.5 ${ACTION_COLORS[log.action] || "bg-gray-50 text-gray-600"}`}
                >
                  {ACTION_LABELS[log.action] || log.action}
                </Badge>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-gray-700">
                    <span className="font-mono text-xs text-gray-400">{log.entityType}/{log.entityId.slice(0, 8)}</span>
                    <span className="ml-2">{formatDetail(log.detail)}</span>
                  </div>
                  {log.detail?.updatedBy != null && (
                    <span className="text-xs text-gray-400">by {String(log.detail.updatedBy as string)}</span>
                  )}
                </div>
                <span className="text-[11px] text-gray-400 shrink-0">
                  {new Date(log.createdAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={14} />
            </Button>
            <span className="text-xs text-gray-500">{page} / {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight size={14} />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
