"use client";

import { Bell, HelpCircle, LogOut } from "lucide-react";
import { useAuth } from "@/components/auth/auth-provider";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  DESK: "데스크",
  COUNSELOR: "상담실장",
  VIEWER: "조회전용",
  MARKETING: "마케팅",
};

const ROLE_COLORS: Record<string, string> = {
  ADMIN: "bg-red-100 text-red-700",
  DESK: "bg-blue-100 text-blue-700",
  COUNSELOR: "bg-green-100 text-green-700",
  VIEWER: "bg-gray-100 text-gray-700",
  MARKETING: "bg-purple-100 text-purple-700",
};

export function Header({
  userName,
  userRole,
}: {
  userName?: string;
  userRole?: string;
}) {
  const { logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
      <div className="md:hidden w-10" />
      <div className="hidden md:block">
        <h2 className="text-sm text-gray-500">
          {new Date().toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
            weekday: "long",
          })}
        </h2>
      </div>
      <div className="flex items-center gap-3">
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <Bell size={18} />
        </button>
        <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg transition-colors">
          <HelpCircle size={18} />
        </button>

        {/* 사용자 정보 */}
        <div className="flex items-center gap-2 pl-2 border-l border-gray-200">
          {userRole && (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${ROLE_COLORS[userRole] || "bg-gray-100 text-gray-700"}`}
            >
              {ROLE_LABELS[userRole] || userRole}
            </span>
          )}
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-medium">
            {userName?.[0] || "?"}
          </div>
          <span className="text-sm text-gray-700 font-medium hidden lg:inline">
            {userName || "사용자"}
          </span>
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            title="로그아웃"
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </header>
  );
}
