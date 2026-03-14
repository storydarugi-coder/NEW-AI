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
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { canAccessPath } from "@/lib/auth";

// ── 메뉴 설정 (config 기반) ──
// group: "company" | "clinic" | "common" — 향후 제품 분리 시 필터링 키
// 각 항목의 href는 현재 라우트 유지, 향후 /company/... /app/... prefix 전환 가능

export type MenuGroup = "company" | "clinic" | "common";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  group: MenuGroup;
}

export interface NavSection {
  group: MenuGroup;
  title: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    group: "company",
    title: "회사 운영",
    items: [
      { label: "CPA 광고 관리", href: "/cta", icon: Megaphone, group: "company" },
      { label: "유입 경로 검토", href: "/source-review", icon: Search, group: "company" },
      { label: "유입 경로 규칙", href: "/source-rules", icon: BookOpen, group: "company" },
      { label: "데이터 가져오기", href: "/sync", icon: RefreshCw, group: "company" },
    ],
  },
  {
    group: "clinic",
    title: "병원 SaaS",
    items: [
      { label: "대시보드", href: "/", icon: LayoutDashboard, group: "clinic" },
      { label: "후속관리 업무", href: "/workflow", icon: ClipboardCheck, group: "clinic" },
      { label: "환자 관리", href: "/patients", icon: Users, group: "clinic" },
      { label: "리콜/후속 메시지", href: "/messages", icon: Mail, group: "clinic" },
      { label: "재내원 성과", href: "/reports", icon: BarChart3, group: "clinic" },
      { label: "설정", href: "/settings", icon: Settings, group: "clinic" },
    ],
  },
  {
    group: "common",
    title: "공통 · 도구",
    items: [
      { label: "CSV Import", href: "/source-import", icon: Upload, group: "common" },
      { label: "제품 소개", href: "/about", icon: Info, group: "common" },
    ],
  },
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

  // 역할별로 접근 가능한 항목만 필터링
  const filteredSections = NAV_SECTIONS
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => canAccessPath(userRole, item.href)),
    }))
    .filter((section) => section.items.length > 0);

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
            <p className="text-[10px] text-gray-400 -mt-0.5">재내원 유도 · 후속관리 · 카카오톡 운영</p>
          </div>
        </div>

        {/* Nav — 그룹별 섹션 */}
        <nav className="mt-2 px-3 space-y-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 200px)" }}>
          {filteredSections.map((section) => (
            <div key={section.group}>
              <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                {section.title}
              </p>
              <div className="space-y-0.5">
                {section.items.map((item) => {
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
                        "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
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
              </div>
            </div>
          ))}
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
