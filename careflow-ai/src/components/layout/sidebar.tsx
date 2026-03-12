"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  Activity,
  Menu,
  X,
  Info,
  Megaphone,
  BookOpen,
  Search,
  Upload,
  RefreshCw,
  Mail,
  BarChart3,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { canAccessPath } from "@/lib/auth";

const allNavItems = [
  { label: "대시보드", href: "/", icon: LayoutDashboard },
  { label: "환자 관리", href: "/patients", icon: Users },
  { label: "CTA 광고 관리", href: "/cta", icon: Megaphone },
  { label: "경로 검토 큐", href: "/source-review", icon: Search },
  { label: "CSV Import", href: "/source-import", icon: Upload },
  { label: "분류 사전", href: "/source-rules", icon: BookOpen },
  { label: "메시지 발송", href: "/messages", icon: Mail },
  { label: "운영 리포트", href: "/reports", icon: BarChart3 },
  { label: "동기화 관리", href: "/sync", icon: RefreshCw },
  { label: "설정", href: "/settings", icon: Settings },
  { label: "제품 소개", href: "/about", icon: Info },
];

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "관리자",
  DESK: "데스크",
  COUNSELOR: "상담실장",
  VIEWER: "조회전용",
  MARKETING: "마케팅",
};

export function Sidebar({ userRole = "ADMIN" }: { userRole?: string }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = allNavItems.filter((item) =>
    canAccessPath(userRole, item.href)
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="fixed top-4 left-4 z-50 md:hidden bg-white rounded-lg p-2 shadow-md border"
      >
        {mobileOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 z-40 transition-transform duration-200",
          "md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-gray-100">
          <Activity className="h-7 w-7 text-blue-600 mr-2" />
          <div>
            <h1 className="text-lg font-bold text-gray-900">CareFlow AI</h1>
            <p className="text-[10px] text-gray-400 -mt-0.5">운영 보조 · 리콜 · 광고 관리</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="mt-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                )}
              >
                <item.icon
                  size={18}
                  className={isActive ? "text-blue-600" : "text-gray-400"}
                />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-3">
          {/* 역할 배지 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-lg">
            <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-[10px] font-bold">
              {ROLE_LABELS[userRole]?.[0] || "?"}
            </div>
            <span className="text-xs font-medium text-blue-700">
              {ROLE_LABELS[userRole] || userRole}
            </span>
          </div>

          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-[11px] text-amber-700 font-medium">
              운영 보조 도구
            </p>
            <p className="text-[10px] text-amber-600 mt-1">
              본 시스템은 병원 운영 보조 및 리콜 추천 도구이며, 의료적 판단을 대신하지 않습니다.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
