"use client";

import { useState } from "react";
import { Activity, Database, RefreshCw, CheckCircle2, AlertTriangle, Server } from "lucide-react";

interface SetupPageProps {
  reason: "connection" | "no-tables" | "no-data";
  detail?: string;
}

export function SetupPage({ reason, detail }: SetupPageProps) {
  const [seeding, setSeeding] = useState(false);
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleSeed = async () => {
    setSeeding(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setResult("success");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const data = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        setErrorMsg(data.error || "시드 실행에 실패했습니다.");
        setResult("error");
      }
    } catch {
      setErrorMsg("서버에 연결할 수 없습니다.");
      setResult("error");
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* 로고 */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 mb-2">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">CareFlow AI</h1>
          </div>
          <p className="text-sm text-gray-500">초기 설정이 필요합니다</p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-5">
          {/* 상태 아이콘 + 제목 */}
          <div className="text-center">
            {reason === "connection" ? (
              <AlertTriangle className="mx-auto h-12 w-12 text-red-400 mb-3" />
            ) : reason === "no-tables" ? (
              <Server className="mx-auto h-12 w-12 text-amber-400 mb-3" />
            ) : (
              <Database className="mx-auto h-12 w-12 text-blue-400 mb-3" />
            )}

            <h2 className="text-lg font-semibold text-gray-900">
              {reason === "connection" && "데이터베이스에 연결할 수 없습니다"}
              {reason === "no-tables" && "데이터베이스 테이블이 없습니다"}
              {reason === "no-data" && "데모 데이터가 아직 없습니다"}
            </h2>
          </div>

          {/* 상태별 안내 */}
          {reason === "connection" && (
            <div className="bg-red-50 rounded-lg p-4 text-sm text-red-700 space-y-2">
              <p>Vercel 환경변수를 확인해주세요:</p>
              <ul className="list-disc ml-5 space-y-1 text-xs">
                <li><code className="bg-red-100 px-1 rounded">DATABASE_URL</code> — Supabase Pooler URL (6543 포트)</li>
                <li><code className="bg-red-100 px-1 rounded">DIRECT_URL</code> — Supabase Direct URL (5432 포트)</li>
                <li><code className="bg-red-100 px-1 rounded">AUTH_SECRET</code> — 세션 서명 키</li>
              </ul>
              {detail && (
                <p className="text-xs text-red-500 mt-2 break-all">
                  에러: {detail}
                </p>
              )}
            </div>
          )}

          {reason === "no-tables" && (
            <div className="bg-amber-50 rounded-lg p-4 text-sm text-amber-700 space-y-3">
              <p>
                DB 연결은 성공했지만, 테이블이 아직 생성되지 않았습니다.
              </p>
              <div className="text-xs space-y-2">
                <p className="font-semibold">해결 방법 (택 1):</p>
                <div className="space-y-1">
                  <p><strong>방법 A — Supabase SQL Editor (권장):</strong></p>
                  <p>Supabase 대시보드 → SQL Editor에서 아래 스키마 SQL을 실행하세요.</p>
                  <p>
                    <a
                      href="/api/setup/schema-sql"
                      target="_blank"
                      className="inline-block mt-1 px-3 py-1.5 bg-amber-600 text-white rounded text-xs hover:bg-amber-700 transition-colors"
                    >
                      스키마 SQL 보기
                    </a>
                  </p>
                </div>
                <div className="space-y-1">
                  <p><strong>방법 B — 로컬 터미널:</strong></p>
                  <code className="block bg-amber-100 px-2 py-1 rounded text-[11px]">
                    npx prisma db push
                  </code>
                </div>
              </div>
            </div>
          )}

          {reason === "no-data" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                테이블은 준비되었습니다. 데모 데이터를 생성하면<br />
                87명의 환자와 로그인 계정이 만들어집니다.
              </p>

              <button
                onClick={handleSeed}
                disabled={seeding || result === "success"}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {seeding ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    데모 데이터 생성 중... (최대 60초)
                  </>
                ) : result === "success" ? (
                  <>
                    <CheckCircle2 className="h-4 w-4" />
                    완료! 로그인 페이지로 이동합니다...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    데모 데이터 생성
                  </>
                )}
              </button>

              {result === "success" && (
                <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 text-center">
                  admin / admin123 으로 로그인하세요
                </div>
              )}
            </div>
          )}

          {result === "error" && (
            <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
