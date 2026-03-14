"use client";

import { useAuth } from "@/components/auth/auth-provider";
import { UserManagement } from "@/components/settings/user-management";
import { AuditLogViewer } from "@/components/settings/audit-log-viewer";
import { Shield } from "lucide-react";
import { redirect } from "next/navigation";

export default function AdminPage() {
  const { user } = useAuth();

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Shield size={24} className="text-blue-600" />
          관리자
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          사용자 관리, 권한 설정, 감사 로그를 확인합니다
        </p>
      </div>

      <UserManagement />
      <AuditLogViewer />
    </div>
  );
}
