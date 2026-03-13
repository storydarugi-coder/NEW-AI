"use client";

import { useState } from "react";
import { Activity, Database, RefreshCw, CheckCircle2, AlertTriangle, Server } from "lucide-react";

interface SetupPageProps {
  reason: "connection" | "no-tables" | "no-data";
  detail?: string;
}

export function SetupPage({ reason, detail }: SetupPageProps) {
  const [seeding, setSeeding] = useState(false);
  const [phase, setPhase] = useState<"idle" | "minimal_done" | "demo_loading" | "demo_done">("idle");
  const [result, setResult] = useState<"success" | "error" | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const handleMinimalSeed = async () => {
    setSeeding(true);
    setResult(null);
    setErrorMsg("");
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      if (res.ok) {
        setPhase("minimal_done");
        setResult("success");
      } else {
        const data = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        const stepInfo = data.step ? ` [${data.step}]` : "";
        const detailInfo = data.detail ? `\n${data.detail.substring(0, 200)}` : "";
        setErrorMsg((data.error || "초기화에 실패했습니다.") + stepInfo + detailInfo);
        setResult("error");
      }
    } catch {
      setErrorMsg("서버에 연결할 수 없습니다.");
      setResult("error");
    } finally {
      setSeeding(false);
    }
  };

  const handleDemoSeed = async () => {
    setPhase("demo_loading");
    setResult(null);
    setErrorMsg("");
    try {
      // 먼저 로그인하여 세션 쿠키 획득
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "admin", password: "admin123" }),
      });
      if (!loginRes.ok) {
        // 로그인 실패 시 바로 대시보드로 이동 (데모 데이터 없이)
        setPhase("demo_done");
        setResult("success");
        setTimeout(() => window.location.reload(), 1500);
        return;
      }

      const res = await fetch("/api/seed/demo", { method: "POST" });
      if (res.ok) {
        setPhase("demo_done");
        setResult("success");
        setTimeout(() => window.location.reload(), 2000);
      } else {
        const data = await res.json().catch(() => ({ error: "알 수 없는 오류" }));
        const stepInfo = data.step ? ` [${data.step}]` : "";
        const detailInfo = data.detail ? `\n${data.detail.substring(0, 200)}` : "";
        setErrorMsg((data.error || "데모 데이터 생성에 실패했습니다.") + stepInfo + detailInfo);
        setResult("error");
        setPhase("minimal_done"); // 실패 시 다시 선택 가능
      }
    } catch {
      setErrorMsg("서버에 연결할 수 없습니다.");
      setResult("error");
      setPhase("minimal_done");
    }
  };

  const handleSkipDemo = () => {
    window.location.reload();
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
            ) : phase === "minimal_done" ? (
              <CheckCircle2 className="mx-auto h-12 w-12 text-green-400 mb-3" />
            ) : (
              <Database className="mx-auto h-12 w-12 text-blue-400 mb-3" />
            )}

            <h2 className="text-lg font-semibold text-gray-900">
              {reason === "connection" && "데이터베이스에 연결할 수 없습니다"}
              {reason === "no-tables" && "데이터베이스 테이블이 없습니다"}
              {reason === "no-data" && phase === "idle" && "초기 설정이 필요합니다"}
              {reason === "no-data" && phase === "minimal_done" && "기본 초기화 완료!"}
              {reason === "no-data" && phase === "demo_loading" && "데모 데이터 생성 중..."}
              {reason === "no-data" && phase === "demo_done" && "설정 완료!"}
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

          {reason === "no-data" && phase === "idle" && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 text-center">
                테이블은 준비되었습니다. 로그인 계정과<br />
                기본 데이터를 생성합니다. (약 10초)
              </p>

              <button
                onClick={handleMinimalSeed}
                disabled={seeding}
                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
              >
                {seeding ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    초기화 중...
                  </>
                ) : (
                  <>
                    <Database className="h-4 w-4" />
                    기본 초기화 시작
                  </>
                )}
              </button>
            </div>
          )}

          {reason === "no-data" && phase === "minimal_done" && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 text-center">
                로그인 계정 + 10명의 환자 데이터가 생성되었습니다.
              </div>

              <p className="text-sm text-gray-600 text-center">
                추가로 데모 데이터(77명의 환자, 메시지, 워크플로우 등)를<br />
                생성하시겠습니까? 나중에도 설정에서 추가할 수 있습니다.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={handleSkipDemo}
                  className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  바로 로그인
                </button>
                <button
                  onClick={handleDemoSeed}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                >
                  <Database className="h-4 w-4" />
                  데모 데이터 추가
                </button>
              </div>

              <p className="text-xs text-gray-400 text-center">
                admin / admin123 으로 로그인할 수 있습니다
              </p>
            </div>
          )}

          {reason === "no-data" && phase === "demo_loading" && (
            <div className="space-y-4">
              <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                <RefreshCw className="h-4 w-4 animate-spin" />
                데모 데이터 생성 중... (최대 60초)
              </div>
            </div>
          )}

          {reason === "no-data" && phase === "demo_done" && (
            <div className="space-y-4">
              <div className="bg-green-50 rounded-lg p-3 text-sm text-green-700 text-center">
                모든 초기화가 완료되었습니다! 로그인 페이지로 이동합니다...
              </div>
              <p className="text-xs text-gray-400 text-center">
                admin / admin123 으로 로그인하세요
              </p>
            </div>
          )}

          {result === "error" && (
            <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg space-y-1">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0" />
                <span className="font-medium">{errorMsg.split("\n")[0]}</span>
              </div>
              {errorMsg.includes("\n") && (
                <pre className="text-xs text-red-500 whitespace-pre-wrap break-all mt-1 pl-6">
                  {errorMsg.split("\n").slice(1).join("\n")}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
