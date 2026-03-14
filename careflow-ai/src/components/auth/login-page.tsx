"use client";

import { useState } from "react";
import { Activity, LogIn, AlertCircle } from "lucide-react";

export function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "로그인에 실패했습니다.");
        return;
      }

      // 제품 영역별 기본 랜딩 페이지로 이동
      const landingMap: Record<string, string> = {
        internal: "/internal/cpa",
        hospital: "/hospital/dashboard",
        all: "/hospital/dashboard",
      };
      const landing = landingMap[data.user?.productArea] || "/hospital/dashboard";
      window.location.href = landing;
    } catch {
      setError("서버에 연결할 수 없습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* 로고 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <Activity className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold text-gray-900">CareFlow AI</h1>
          </div>
          <p className="text-sm text-gray-500">
            운영 보조 · 리콜 · 광고 관리
          </p>
        </div>

        {/* 로그인 카드 */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">로그인</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사용자명
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="사용자명 입력"
                autoComplete="username"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                비밀번호
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                placeholder="비밀번호 입력"
                autoComplete="current-password"
                required
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-3 rounded-lg">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <LogIn size={16} />
              {loading ? "로그인 중..." : "로그인"}
            </button>
          </form>
        </div>

        {/* 데모 계정 안내 */}
        <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 mb-2">
            데모 계정 안내
          </p>
          <div className="space-y-1 text-xs text-amber-600">
            <p>
              <span className="font-mono bg-amber-100 px-1 rounded">admin</span>
              {" / "}
              <span className="font-mono bg-amber-100 px-1 rounded">admin123</span>
              {" — 관리자 (전체 권한)"}
            </p>
            <p>
              <span className="font-mono bg-amber-100 px-1 rounded">desk01</span>
              {" / "}
              <span className="font-mono bg-amber-100 px-1 rounded">desk123</span>
              {" — 데스크 (환자 관리/검토)"}
            </p>
            <p>
              <span className="font-mono bg-amber-100 px-1 rounded">counsel01</span>
              {" / "}
              <span className="font-mono bg-amber-100 px-1 rounded">counsel123</span>
              {" — 상담실장"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
