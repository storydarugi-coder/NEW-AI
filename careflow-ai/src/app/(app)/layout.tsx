import { AuthGate } from "@/components/auth/auth-gate";

// 모든 (app)/ 하위 페이지에 대해 동적 렌더링 강제.
// AuthGate가 cookies() + prisma.user.count()를 사용하므로
// 빌드 타임 정적 생성 시 DB 연결 타임아웃이 발생함.
// 이 설정이 모든 자식 페이지에 전파되므로 개별 페이지에서 중복 선언 불필요.
//
// ── 페이지별 렌더링 전략 분석 (2026-03) ──
// 반드시 dynamic: /, patients, patients/[id], workflow, settings, reports (서버 Prisma 조회)
// 클라이언트 전용 래퍼: cta, messages, sync, source-import, source-review, source-rules
// → 위 6개 페이지는 서버 데이터 없이 client component만 렌더하지만,
//   AuthGate가 layout 레벨에서 cookies()를 호출하므로 전체가 dynamic 필수.
// → 구조 변경(AuthGate를 미들웨어/클라이언트로 이동) 시 해제 가능.
export const dynamic = "force-dynamic";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthGate>{children}</AuthGate>;
}
