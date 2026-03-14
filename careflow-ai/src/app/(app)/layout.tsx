import { AuthGate } from "@/components/auth/auth-gate";

// 모든 (app)/ 하위 페이지에 대해 동적 렌더링 강제.
// AuthGate가 cookies() + prisma.user.count()를 사용하므로
// 빌드 타임 정적 생성 시 DB 연결 타임아웃이 발생함.
// 이 설정이 모든 자식 페이지에 전파되므로 개별 페이지에서 중복 선언 불필요.
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
