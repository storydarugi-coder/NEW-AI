import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LoginPage } from "@/components/auth/login-page";

/**
 * 서버 컴포넌트: 쿠키 기반 인증 게이트
 * - 세션 없으면 → 로그인 화면
 * - 세션 있으면 → 사이드바/헤더 + 콘텐츠
 */
export async function AuthGate({ children }: { children: React.ReactNode }) {
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
