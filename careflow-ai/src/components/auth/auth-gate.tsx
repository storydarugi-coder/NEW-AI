import { cookies } from "next/headers";
import { verifySession } from "@/lib/auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { AuthProvider } from "@/components/auth/auth-provider";
import { LoginPage } from "@/components/auth/login-page";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { SetupPage } from "@/components/auth/setup-page";

/**
 * DB 상태 + 유저 존재 여부 캐시
 *
 * DB가 정상이고 유저가 1명 이상 존재하면 "ready" 상태로 캐시합니다.
 * 한번 ready가 되면 60초간 재확인하지 않습니다.
 * 초기 셋업/마이그레이션 중에는 매 요청 확인합니다.
 */
type DbState =
  | { status: "ready" }
  | { status: "no-connection"; error?: string }
  | { status: "no-tables" }
  | { status: "no-data" };

let dbStateCache: DbState | null = null;
let dbStateCachedAt = 0;
const DB_STATE_TTL_MS = 60_000; // ready 상태일 때만 60초 캐시

async function getDbState(): Promise<DbState> {
  const now = Date.now();

  // ready 상태에서만 캐시 히트 (비정상 상태는 항상 재확인)
  if (dbStateCache?.status === "ready" && now - dbStateCachedAt < DB_STATE_TTL_MS) {
    return dbStateCache;
  }

  const dbCheck = await isDatabaseAvailable();
  if (!dbCheck.available) {
    dbStateCache = { status: "no-connection", error: dbCheck.error };
    dbStateCachedAt = now;
    return dbStateCache;
  }

  let userCount = 0;
  try {
    userCount = await prisma.user.count();
  } catch {
    dbStateCache = { status: "no-tables" };
    dbStateCachedAt = now;
    return dbStateCache;
  }

  if (userCount === 0) {
    dbStateCache = { status: "no-data" };
    dbStateCachedAt = now;
    return dbStateCache;
  }

  dbStateCache = { status: "ready" };
  dbStateCachedAt = now;
  return dbStateCache;
}

/**
 * 서버 컴포넌트: 쿠키 기반 인증 게이트
 * 1. DB 연결 불가 / 테이블 없음 / User 없음 → 초기화 안내 화면
 * 2. 세션 없으면 → 로그인 화면
 * 3. 세션 있으면 → 사이드바/헤더 + 콘텐츠
 */
export async function AuthGate({ children }: { children: React.ReactNode }) {
  // ── 1단계: DB 상태 확인 (캐시됨) ──
  const dbState = await getDbState();

  if (dbState.status === "no-connection") {
    return <SetupPage reason="connection" detail={dbState.error} />;
  }
  if (dbState.status === "no-tables") {
    return <SetupPage reason="no-tables" />;
  }
  if (dbState.status === "no-data") {
    return <SetupPage reason="no-data" />;
  }

  // ── 2단계: 인증 확인 (항상 실행 — 세션은 캐시 불가) ──
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("session")?.value);

  if (!session) {
    return <LoginPage />;
  }

  return (
    <AuthProvider user={session}>
      <Sidebar userRole={session.role} productArea={session.productArea} />
      <div className="md:ml-64 min-h-screen flex flex-col">
        <Header userName={session.name} userRole={session.role} />
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </AuthProvider>
  );
}
