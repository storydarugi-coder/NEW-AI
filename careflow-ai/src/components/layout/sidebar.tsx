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
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    label: "대시보드",
    href: "/",
    icon: LayoutDashboard,
  },
  {
    label: "환자 관리",
    href: "/patients",
    icon: Users,
  },
  {
    label: "설정",
    href: "/settings",
    icon: Settings,
  },
  {
    label: "제품 소개",
    href: "/about",
    icon: Info,
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

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
            <p className="text-[10px] text-gray-400 -mt-0.5">운영 보조 · 리콜 추천</p>
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
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-100">
          <div className="bg-amber-50 rounded-lg p-3 border border-amber-100">
            <p className="text-[11px] text-amber-700 font-medium">
              ⚕️ 운영 보조 도구
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
