import { createHmac } from "crypto";

const AUTH_SECRET =
  process.env.AUTH_SECRET || "careflow-dev-secret-change-in-production";

// ── Session Types ──

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: string; // ADMIN, DESK, COUNSELOR, VIEWER, MARKETING
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
    return JSON.parse(Buffer.from(payload, "base64url").toString());
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
    "/workflow",
    "/patients",
    "/messages",
    "/reports",
    "/source-review",
    "/source-import",
    "/source-rules",
    "/sync",
    "/settings",
    "/about",
  ],
  COUNSELOR: ["/", "/workflow", "/patients", "/messages", "/cta", "/about"],
  VIEWER: ["/", "/patients", "/about"],
  MARKETING: ["/", "/cta", "/source-review", "/reports", "/about"],
};

export function canAccessPath(role: string, path: string): boolean {
  const allowed = ROLE_NAV_ACCESS[role];
  if (!allowed) return false;
  if (allowed.includes("*")) return true;
  return allowed.some((p) => (p === "/" ? path === "/" : path.startsWith(p)));
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
    "review_cta",
  ],
  VIEWER: ["view_patients"],
  MARKETING: ["view_patients", "review_cta", "review_source", "export_data", "view_reports"],
};

export function hasCapability(role: string, cap: string): boolean {
  const caps = ROLE_CAPABILITIES[role];
  if (!caps) return false;
  if (caps.includes("*")) return true;
  return caps.includes(cap);
}
