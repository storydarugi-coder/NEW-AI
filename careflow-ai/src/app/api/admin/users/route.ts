import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin } from "@/lib/api-auth";
import type { ProductArea } from "@/lib/auth";
import { ProductArea as PrismaProductArea } from "@prisma/client";

const VALID_PRODUCT_AREAS: ProductArea[] = ["hospital", "internal", "all"];
const VALID_ROLES = ["ADMIN", "DESK", "COUNSELOR", "VIEWER", "MARKETING"];

/**
 * 관리자용 사용자 관리 API
 *
 * GET  /api/admin/users — 전체 사용자 목록 (productArea 포함)
 * PATCH /api/admin/users — 사용자 정보 수정 (productArea, role, isActive)
 */

export async function GET() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        productArea: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error("[Admin/Users] GET error:", error);
    return NextResponse.json(
      { error: "사용자 목록 조회 실패" },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const body = await request.json();
    const { userId, productArea, role, isActive } = body as {
      userId: string;
      productArea?: string;
      role?: string;
      isActive?: boolean;
    };

    if (!userId) {
      return NextResponse.json({ error: "userId가 필요합니다." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) {
      return NextResponse.json({ error: "사용자를 찾을 수 없습니다." }, { status: 404 });
    }

    // 변경 사항 수집
    const data: Record<string, unknown> = {};
    const changes: Record<string, { from: unknown; to: unknown }> = {};

    if (productArea !== undefined) {
      if (!VALID_PRODUCT_AREAS.includes(productArea as ProductArea)) {
        return NextResponse.json(
          { error: `productArea는 ${VALID_PRODUCT_AREAS.join(", ")} 중 하나여야 합니다.` },
          { status: 400 }
        );
      }
      if (productArea !== target.productArea) {
        changes.productArea = { from: target.productArea, to: productArea };
        data.productArea = productArea as PrismaProductArea;
      }
    }

    if (role !== undefined) {
      if (!VALID_ROLES.includes(role)) {
        return NextResponse.json(
          { error: `role은 ${VALID_ROLES.join(", ")} 중 하나여야 합니다.` },
          { status: 400 }
        );
      }
      if (role !== target.role) {
        changes.role = { from: target.role, to: role };
        data.role = role;
      }
    }

    if (typeof isActive === "boolean" && isActive !== target.isActive) {
      changes.isActive = { from: target.isActive, to: isActive };
      data.isActive = isActive;
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
    }

    // 자기 자신의 ADMIN 권한 해제 방지
    if (target.id === session.id && data.role && data.role !== "ADMIN") {
      return NextResponse.json(
        { error: "자신의 관리자 권한은 해제할 수 없습니다." },
        { status: 400 }
      );
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        productArea: true,
        isActive: true,
        updatedAt: true,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "admin_update_user",
        entityType: "user",
        entityId: userId,
        detail: JSON.stringify({
          changes,
          updatedBy: session.username,
          targetUser: target.username,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      user: updated,
      changes,
      notice: Object.keys(changes).includes("productArea") || Object.keys(changes).includes("role")
        ? "변경 사항은 해당 사용자가 다시 로그인한 후 적용됩니다."
        : undefined,
    });
  } catch (error) {
    console.error("[Admin/Users] PATCH error:", error);
    return NextResponse.json(
      { error: "사용자 정보 수정 실패" },
      { status: 500 }
    );
  }
}
