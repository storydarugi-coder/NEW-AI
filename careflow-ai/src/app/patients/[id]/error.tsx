"use client";

import { useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[CareFlow] 환자 상세 에러:", error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-lg w-full">
        <CardContent className="pt-6 text-center space-y-4">
          <AlertTriangle className="mx-auto h-12 w-12 text-amber-500" />
          <h2 className="text-xl font-semibold text-gray-900">
            환자 정보를 불러올 수 없습니다
          </h2>
          <p className="text-gray-500 text-sm">
            데이터베이스 연결을 확인하거나, 환자 목록에서 다시 선택해 주세요.
          </p>
          <div className="flex gap-2 justify-center">
            <button
              onClick={reset}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              다시 시도
            </button>
            <Link
              href="/patients"
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
            >
              환자 목록으로
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
