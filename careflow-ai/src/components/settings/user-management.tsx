"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Loader2, CheckCircle, Shield } from "lucide-react";

interface UserInfo {
  id: string;
  username: string;
  name: string;
  role: string;
  productArea: string;
  isActive: boolean;
  updatedAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  DESK: "데스크",
  COUNSELOR: "상담실장",
  VIEWER: "조회전용",
  MARKETING: "마케팅",
};

const AREA_LABELS: Record<string, string> = {
  hospital: "병원 SaaS",
  internal: "내부 운영",
  all: "전체",
};

const AREA_COLORS: Record<string, string> = {
  hospital: "bg-blue-50 text-blue-700 border-blue-200",
  internal: "bg-purple-50 text-purple-700 border-purple-200",
  all: "bg-green-50 text-green-700 border-green-200",
};

export function UserManagement() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/users");
      if (!res.ok) {
        if (res.status === 403) {
          setError("관리자 권한이 필요합니다.");
          return;
        }
        throw new Error("조회 실패");
      }
      const data = await res.json();
      setUsers(data.users);
    } catch {
      setError("사용자 목록을 불러올 수 없습니다.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function updateUser(userId: string, field: string, value: string | boolean) {
    setSaving(userId);
    setError(null);
    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, [field]: value }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "수정 실패");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, ...data.user } : u))
      );
      setSaved(userId);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError("서버 연결 실패");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="p-8 text-center text-gray-400">
          <Loader2 className="animate-spin mx-auto mb-2" size={20} />
          사용자 목록 로딩 중...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield size={18} className="text-indigo-600" />
          사용자 · 제품 영역 관리
        </CardTitle>
        <p className="text-xs text-gray-500 mt-1">
          사용자별 역할과 제품 영역을 설정합니다. 변경 후 해당 사용자가 재로그인해야 적용됩니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-gray-500">
                <th className="pb-2 font-medium">사용자</th>
                <th className="pb-2 font-medium">역할</th>
                <th className="pb-2 font-medium">제품 영역</th>
                <th className="pb-2 font-medium">상태</th>
                <th className="pb-2 font-medium w-16"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((user) => (
                <tr key={user.id} className="group">
                  <td className="py-3">
                    <div>
                      <span className="font-medium text-gray-900">{user.name}</span>
                      <span className="ml-2 text-xs text-gray-400 font-mono">{user.username}</span>
                    </div>
                  </td>
                  <td className="py-3">
                    <select
                      value={user.role}
                      onChange={(e) => updateUser(user.id, "role", e.target.value)}
                      disabled={saving === user.id}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      {Object.entries(ROLE_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-3">
                    <select
                      value={user.productArea}
                      onChange={(e) => updateUser(user.id, "productArea", e.target.value)}
                      disabled={saving === user.id}
                      className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
                    >
                      {Object.entries(AREA_LABELS).map(([val, label]) => (
                        <option key={val} value={val}>{label}</option>
                      ))}
                    </select>
                    <Badge
                      variant="outline"
                      className={`ml-2 text-[10px] ${AREA_COLORS[user.productArea] || ""}`}
                    >
                      {AREA_LABELS[user.productArea] || user.productArea}
                    </Badge>
                  </td>
                  <td className="py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => updateUser(user.id, "isActive", !user.isActive)}
                      disabled={saving === user.id}
                      className={`text-xs ${user.isActive ? "text-green-600" : "text-red-500"}`}
                    >
                      {user.isActive ? "활성" : "비활성"}
                    </Button>
                  </td>
                  <td className="py-3 text-center">
                    {saving === user.id && <Loader2 size={14} className="animate-spin text-gray-400" />}
                    {saved === user.id && <CheckCircle size={14} className="text-green-500" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 mt-4">
          <p className="text-xs text-amber-700">
            <Users size={12} className="inline mr-1" />
            제품 영역을 변경하면 해당 사용자의 사이드바 메뉴와 API 접근 권한이 변경됩니다.
            변경 사항은 감사 로그에 기록됩니다.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
