import { createHmac } from "crypto";

const AUTH_SECRET =
  process.env.AUTH_SECRET || "careflow-dev-secret-change-in-production";

// ── Product Area ──

/**
 * 제품 영역 구분
 * - hospital: 병원 SaaS (재내원 유도, 후속관리, 메시지)
 * - internal: 회사 내부용 (CPA 운영, 유입 경로 관리)
 * - all: 양쪽 모두 (관리자 전용)
 */
export type ProductArea = "hospital" | "internal" | "all";

// ── Session Types ──

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string; // ADMIN, DESK, COUNSELOR, VIEWER, MARKETING
  productArea: ProductArea;
  tenantId?: string | null; // 멀티테넌시: null = 슈퍼어드민/레거시
  sessionVersion?: number; // 관리자 변경 시 증가 → 기존 세션 강제 무효화
}

// ── Token (HMAC-signed cookie) ──

function sign(payload: string): string {
  return createHmac("sha256", AUTH_SECRET).update(payload).digest("base64url");
}

export function createSessionToken(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifySession(token?: string): SessionUser | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = token.slice(0, dot);
  const signature = token.slice(dot + 1);
  if (sign(payload) !== signature) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    // 하위 호환: productArea가 없는 레거시 토큰 처리
    if (!parsed.productArea) {
      parsed.productArea = inferProductArea(parsed.role);
    }
    return parsed;
  } catch {
    return null;
  }
}

// ── Password hashing (HMAC — 충분한 mock 수준, 프로덕션에서는 bcrypt 권장) ──

export function hashPassword(password: string): string {
  return createHmac("sha256", AUTH_SECRET).update(password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// ── Role & Permission ──

export type UserRole = "ADMIN" | "DESK" | "COUNSELOR" | "VIEWER" | "MARKETING";

/**
 * 역할별 접근 가능 경로 접두사
 * ADMIN은 모든 경로 접근 가능
 */
export const ROLE_NAV_ACCESS: Record<string, string[]> = {
  ADMIN: ["*"],
  DESK: [
    "/",
    "/hospital/dashboard",
    "/hospital/workflow",
    "/hospital/patients",
    "/hospital/messages",
    "/hospital/reports",
    "/hospital/settings",
    "/internal/source-review",
    "/internal/import",
    "/internal/source-rules",
    "/internal/sync",
    "/about",
  ],
  COUNSELOR: ["/", "/hospital/dashboard", "/hospital/workflow", "/hospital/patients", "/hospital/messages", "/internal/cpa", "/about"],
  VIEWER: ["/", "/hospital/dashboard", "/hospital/patients", "/about"],
  MARKETING: ["/", "/internal/cpa", "/internal/source-review", "/hospital/reports", "/about"],
};

/**
 * 제품 영역별 경로 분류
 * 메뉴 필터링과 접근 제어에 사용
 */
export const PRODUCT_AREA_PATHS: Record<ProductArea, string[]> = {
  hospital: ["/", "/hospital/dashboard", "/hospital/workflow", "/hospital/patients", "/hospital/messages", "/hospital/reports", "/hospital/settings", "/about"],
  internal: ["/internal/cpa", "/internal/source-review", "/internal/source-rules", "/internal/sync", "/internal/import", "/hospital/reports", "/about"],
  all: ["*"],
};
// /hospital/reports, /about 은 양쪽 모두에 포함 — 의도적 공유 항목

/**
 * 역할에서 기본 productArea 추론 (User.productArea가 없는 레거시 데이터용)
 */
export function inferProductArea(role: string): ProductArea {
  switch (role) {
    case "ADMIN": return "all";
    case "MARKETING": return "internal";
    case "VIEWER": return "hospital";
    case "COUNSELOR": return "hospital";
    case "DESK": return "all";
    default: return "hospital";
  }
}

/**
 * 제품 영역 기본 랜딩 경로
 */
export function getDefaultLandingPath(productArea: ProductArea): string {
  switch (productArea) {
    case "internal": return "/internal/cpa";
    case "hospital": return "/hospital/dashboard";
    case "all": return "/hospital/dashboard";
    default: return "/hospital/dashboard";
  }
}

/**
 * 경로 접근 가능 여부 판단 (role + productArea)
 */
export function canAccessPath(role: string, path: string, productArea?: ProductArea): boolean {
  // 1. 역할 기반 접근 체크
  const allowed = ROLE_NAV_ACCESS[role];
  if (!allowed) return false;
  const roleAllowed = allowed.includes("*") || allowed.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));
  if (!roleAllowed) return false;

  // 2. productArea가 없으면 역할만으로 판단 (하위 호환)
  if (!productArea) return true;
  if (productArea === "all") return true;

  // 3. 제품 영역 필터
  const areaPaths = PRODUCT_AREA_PATHS[productArea];
  if (!areaPaths) return true;
  return areaPaths.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));
}

/**
 * 세부 권한 체크 (API 등)
 */
export const ROLE_CAPABILITIES: Record<string, string[]> = {
  ADMIN: ["*"],
  DESK: [
    "review_source",
    "import_csv",
    "review_workflow",
    "send_message",
    "view_patients",
    "view_sync",
    "view_reports",
  ],
  COUNSELOR: [
    "review_workflow",
    "send_message",
    "view_patients",
    "review_cpa",
  ],
  VIEWER: ["view_patients"],
  MARKETING: ["view_patients", "review_cpa", "review_source", "export_data", "view_reports"],
};

export function hasCapability(role: string, cap: string): boolean {
  const caps = ROLE_CAPABILITIES[role];
  if (!caps) return false;
  if (caps.includes("*")) return true;
  return caps.includes(cap);
}
