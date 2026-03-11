"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CareFlow] 페이지 에러:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">
            페이지를 불러올 수 없습니다
          </h2>
          <p className="text-gray-500 text-sm">
            데이터베이스 연결 문제이거나 일시적인 오류입니다.
            <br />
            배포 환경인 경우, 클라우드 데이터베이스 설정이 필요합니다.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 text-left text-xs text-gray-600 space-y-1">
            <p className="font-medium text-gray-700">문제 해결 방법:</p>
            <p>1. 로컬: <code className="bg-gray-200 px-1 rounded">npm run db:reset</code> 실행</p>
            <p>2. Vercel: DATABASE_URL 환경변수에 PostgreSQL URL 설정</p>
            <p>3. Vercel: 배포 후 <code className="bg-gray-200 px-1 rounded">/api/seed</code> 호출로 데이터 초기화</p>
          </div>
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            다시 시도
          </button>
        </CardContent>
      </Card>
    </div>
  );
}
