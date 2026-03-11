"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Database, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";

interface DbUnavailableProps {
  reason: "connection" | "empty";
}

export function DbUnavailable({ reason }: DbUnavailableProps) {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);

  const handleSeed = async () => {
    setSeeding(true);
    setResult(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setResult("success");
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult("error");
      }
    } catch {
      setResult("error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-5">
          <Database className="mx-auto h-14 w-14 text-blue-400" />
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">
              {reason === "connection"
                ? "데이터베이스에 연결할 수 없습니다"
                : "데이터가 아직 초기화되지 않았습니다"}
            </h2>
            <p className="text-gray-500 text-sm">
              {reason === "connection"
                ? "DATABASE_URL 환경변수를 확인하고, 스키마가 반영되었는지 확인해 주세요."
                : "데모 데이터를 생성하면 CareFlow AI의 모든 기능을 체험할 수 있습니다."}
            </p>
          </div>

          {reason === "empty" && (
            <button
              onClick={handleSeed}
              disabled={seeding || result === "success"}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
            >
              {seeding ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  데모 데이터 생성 중...
                </>
              ) : result === "success" ? (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  생성 완료! 페이지를 새로고침합니다...
                </>
              ) : (
                "데모 데이터 생성 (45명의 환자)"
              )}
            </button>
          )}

          {result === "error" && (
            <p className="text-red-500 text-sm flex items-center justify-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              데이터 생성에 실패했습니다. 데이터베이스 연결을 확인해 주세요.
            </p>
          )}

          <div className="bg-gray-50 rounded-lg p-4 text-left text-xs text-gray-600 space-y-2">
            <p className="font-semibold text-gray-700">설정 방법:</p>
            <div className="space-y-1">
              <p><span className="font-medium">로컬 개발:</span></p>
              <code className="block bg-gray-200 px-2 py-1 rounded text-[11px]">
                npm run db:reset
              </code>
            </div>
            <div className="space-y-1">
              <p><span className="font-medium">Vercel 배포:</span></p>
              <p>1. PostgreSQL DB 생성 (Neon, Supabase 등 무료 제공)</p>
              <p>2. Vercel 환경변수에 <code className="bg-gray-200 px-1 rounded">DATABASE_URL</code> 설정</p>
              <p>3. <code className="bg-gray-200 px-1 rounded">prisma/schema.prisma</code>의 provider를 <code className="bg-gray-200 px-1 rounded">postgresql</code>로 변경</p>
              <p>4. 재배포 후 이 페이지에서 &quot;데모 데이터 생성&quot; 클릭</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
