import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LoginPage } from "@/components/auth/login-page";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { SetupPage } from "@/components/auth/setup-page";

/**
 * 서버 컴포넌트: 쿠키 기반 인증 게이트
 * 1. DB 연결 불가 / 테이블 없음 / User 없음 → 초기화 안내 화면
 * 2. 세션 없으면 → 로그인 화면
 * 3. 세션 있으면 → 사이드바/헤더 + 콘텐츠
 */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  // ── 1단계: DB 상태 확인 ──
  const dbCheck = await isDatabaseAvailable();
  if (!dbCheck.available) {
    return <SetupPage reason="connection" detail={dbCheck.error} />;
  }

  // 테이블 존재 + User 데이터 확인
  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    // User 테이블이 없으면 스키마 미적용 상태
    return <SetupPage reason="no-tables" />;
  }

  if (userCount === 0) {
    return <SetupPage reason="no-data" />;
  }

  // ── 2단계: 인증 확인 ──
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("session")?.value);

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AuthProvider user={session}>
      <Sidebar userRole={session.role} />
      <div className="md:ml-64 min-h-screen flex flex-col">
        <Header userName={session.name} userRole={session.role} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
