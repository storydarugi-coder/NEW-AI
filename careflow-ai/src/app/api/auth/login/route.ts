import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { verifyPassword, createSessionToken, inferProductArea } from "@/lib/auth";
import type { ProductArea } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    // 1. DB 연결 확인
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      console.error("[Auth] DB 연결 실패:", dbCheck.error);
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다. 관리자에게 문의하세요." },
        { status: 503 }
      );
    }

    // 2. 요청 본문 파싱
    let body: { username?: string; password?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "잘못된 요청 형식입니다." },
        { status: 400 }
      );
    }

    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "사용자명과 비밀번호를 입력해주세요." },
        { status: 400 }
      );
    }

    // 3. 사용자 조회
    const user = await prisma.user.findUnique({ where: { username } });

    if (!user) {
      return NextResponse.json(
        { error: "사용자를 찾을 수 없습니다." },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: "비활성화된 계정입니다. 관리자에게 문의하세요." },
        { status: 401 }
      );
    }

    // 4. 비밀번호 검증
    if (!verifyPassword(password, user.passwordHash)) {
      return NextResponse.json(
        { error: "비밀번호가 올바르지 않습니다." },
        { status: 401 }
      );
    }

    // 5. 세션 토큰 생성 (productArea: DB enum 값 사용)
    const productArea: ProductArea = user.productArea as ProductArea;

    const token = createSessionToken({
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      productArea,
    });

    // 6. 응답 + 쿠키 설정
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        productArea,
      },
    });

    response.cookies.set("session", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7일
    });

    return response;
  } catch (error) {
    // Prisma 테이블 미존재 에러 감지
    const errMsg = error instanceof Error ? error.message : String(error);
    if (errMsg.includes("does not exist") || errMsg.includes("relation") || errMsg.includes("P2021")) {
      console.error("[Auth] User 테이블이 존재하지 않습니다. prisma db push 및 시드 실행이 필요합니다.");
      return NextResponse.json(
        { error: "데이터베이스 초기화가 필요합니다. /api/seed를 먼저 실행해주세요." },
        { status: 503 }
      );
    }

    console.error("[Auth] 로그인 처리 오류:", errMsg);
    return NextResponse.json(
      { error: "로그인 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
