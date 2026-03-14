import { AuthGate } from "@/components/auth/auth-gate";

// 빌드 시 정적 생성 방지 — AuthGate가 DB/cookies에 의존하므로
// 빌드 타임에 렌더링하면 DB 연결 타임아웃 발생
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
