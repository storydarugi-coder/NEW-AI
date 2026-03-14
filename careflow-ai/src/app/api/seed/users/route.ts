import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { hashPassword, verifySession } from "@/lib/auth";

/**
 * 사용자 계정만 독립적으로 생성/복구하는 엔드포인트
 *
 * - 기본 시드가 타임아웃/에러로 사용자 계정 생성에 실패했을 때 사용
 * - upsert로 안전하게 중복 실행 가능
 * - User가 0명이면 인증 없이 허용 (로그인 불가 상태이므로)
 *
 * GET: 현재 사용자 수 확인
 * POST: 기본 계정 6개 upsert 생성
 */

export const maxDuration = 30;

const DEFAULT_USERS = [
  { username: "admin", password: "admin123", name: "관리자 홍길동", role: "ADMIN", productArea: "all" },
  { username: "desk01", password: "desk123", name: "데스크 김소연", role: "DESK", productArea: "hospital" },
  { username: "desk02", password: "desk123", name: "데스크 이지은", role: "DESK", productArea: "all" },
  { username: "counsel01", password: "counsel123", name: "상담실장 박미영", role: "COUNSELOR", productArea: "hospital" },
  { username: "viewer01", password: "view123", name: "원장 최진수", role: "VIEWER", productArea: "hospital" },
  { username: "mkt01", password: "mkt123", name: "마케팅 정하늘", role: "MARKETING", productArea: "internal" },
];

export async function POST(request: NextRequest) {
  try {
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      return NextResponse.json({ error: "DB 연결 불가", detail: dbCheck.error }, { status: 503 });
    }

    // User가 없으면 인증 없이 허용 (로그인 자체가 불가하므로)
    let userCount = 0;
    try {
      userCount = await prisma.user.count();
    } catch {
      // 테이블 없으면 0으로 간주
    }

    if (userCount > 0) {
      const sessionToken = request.cookies.get("session")?.value;
      const user = verifySession(sessionToken);
      if (!user || user.role !== "ADMIN") {
        return NextResponse.json({ error: "ADMIN 권한이 필요합니다." }, { status: 403 });
      }
    }

    const now = new Date();
    const results: string[] = [];

    for (const u of DEFAULT_USERS) {
      await prisma.user.upsert({
        where: { username: u.username },
        update: { passwordHash: hashPassword(u.password), name: u.name, role: u.role, productArea: u.productArea, isActive: true, updatedAt: now },
        create: { id: randomUUID(), username: u.username, passwordHash: hashPassword(u.password), name: u.name, role: u.role, productArea: u.productArea, updatedAt: now },
      });
      results.push(`${u.username} (${u.role})`);
    }

    return NextResponse.json({
      success: true,
      message: `${results.length}개 사용자 계정이 생성/갱신되었습니다.`,
      accounts: results,
      loginInfo: { username: "admin", password: "admin123" },
    });
  } catch (error) {
    console.error("[Seed/Users] 오류:", error);
    return NextResponse.json(
      { error: "사용자 계정 생성 실패", detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      return NextResponse.json({ status: "db_unavailable", userCount: 0, error: dbCheck.error });
    }
    const users = await prisma.user.findMany({
      select: { username: true, name: true, role: true, isActive: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ status: "ok", userCount: users.length, users });
  } catch {
    return NextResponse.json({ status: "error", userCount: 0, message: "User 테이블이 존재하지 않거나 조회 실패" });
  }
}
