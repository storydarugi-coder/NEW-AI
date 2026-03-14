import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { verifySession, hasCapability } from "./auth";
import { prisma } from "./prisma";
import type { SessionUser, ProductArea } from "./auth";

/**
 * API Route용 인증/인가 헬퍼
 *
 * 사용 예시:
 *   const { session, error } = await requireSession();
 *   if (error) return error;
 *
 *   const areaError = requireProductArea(session, "hospital");
 *   if (areaError) return areaError;
 */

// ── 세션 필수 ──

interface SessionResult {
  session: SessionUser;
  error: null;
}
interface SessionError {
  session: null;
  error: NextResponse;
}

export async function requireSession(): Promise<SessionResult | SessionError> {
  const cookieStore = await cookies();
  const session = verifySession(cookieStore.get("session")?.value);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json(
        { error: "인증이 필요합니다." },
        { status: 401 }
      ),
    };
  }

  // sessionVersion 체크: 관리자가 role/productArea를 변경하면 기존 세션 무효화
  if (session.sessionVersion != null) {
    const dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: { sessionVersion: true, isActive: true },
    });
    if (!dbUser || !dbUser.isActive) {
      return {
        session: null,
        error: NextResponse.json(
          { error: "계정이 비활성화되었습니다. 다시 로그인하세요.", code: "SESSION_EXPIRED" },
          { status: 401 }
        ),
      };
    }
    if (dbUser.sessionVersion !== session.sessionVersion) {
      return {
        session: null,
        error: NextResponse.json(
          { error: "권한이 변경되었습니다. 다시 로그인하세요.", code: "SESSION_EXPIRED" },
          { status: 401 }
        ),
      };
    }
  }

  return { session, error: null };
}

// ── 제품 영역 제한 ──

/**
 * 세션의 productArea가 요구 영역과 일치하는지 확인
 * "all"은 모든 영역 접근 가능
 */
export function requireProductArea(
  session: SessionUser,
  required: ProductArea
): NextResponse | null {
  if (session.productArea === "all") return null;
  if (session.productArea === required) return null;
  return NextResponse.json(
    { error: "이 기능에 대한 접근 권한이 없습니다." },
    { status: 403 }
  );
}

// ── 역할 기반 기능 권한 ──

export function requireCapability(
  session: SessionUser,
  capability: string
): NextResponse | null {
  if (hasCapability(session.role, capability)) return null;
  return NextResponse.json(
    { error: "이 작업을 수행할 권한이 없습니다." },
    { status: 403 }
  );
}

// ── ADMIN 전용 ──

export function requireAdmin(session: SessionUser): NextResponse | null {
  if (session.role === "ADMIN") return null;
  return NextResponse.json(
    { error: "관리자 권한이 필요합니다." },
    { status: 403 }
  );
}

// ── API route별 제품 영역 매핑 ──

/**
 * API 경로에서 제품 영역 추론
 * 서버 접근 제어에 사용 (클라이언트 sidebar 필터와 별도)
 */
const API_AREA_MAP: Array<{ prefix: string; area: ProductArea }> = [
  // internal 전용
  { prefix: "/api/cta", area: "internal" },
  { prefix: "/api/source-review", area: "internal" },
  { prefix: "/api/source-rules", area: "internal" },
  { prefix: "/api/source-import", area: "internal" },
  { prefix: "/api/sync", area: "internal" },
  // hospital 전용
  { prefix: "/api/dashboard", area: "hospital" },
  { prefix: "/api/workflow", area: "hospital" },
  { prefix: "/api/messages", area: "hospital" },
  { prefix: "/api/outbound", area: "hospital" },
  { prefix: "/api/patients", area: "hospital" },
];

export function getApiProductArea(pathname: string): ProductArea | null {
  for (const { prefix, area } of API_AREA_MAP) {
    if (pathname.startsWith(prefix)) return area;
  }
  return null; // shared (reports, auth, seed, settings, staff)
}
