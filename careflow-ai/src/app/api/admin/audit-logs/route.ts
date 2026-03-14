import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession, requireAdmin } from "@/lib/api-auth";

/**
 * 감사 로그 조회 API (ADMIN 전용)
 *
 * GET /api/admin/audit-logs?page=1&limit=50&action=admin_update_user&entityType=user
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const adminError = requireAdmin(session);
    if (adminError) return adminError;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "50")));
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");

    const where: Record<string, unknown> = {};
    if (action) where.action = action;
    if (entityType) where.entityType = entityType;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs: logs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        detail: l.detail ? JSON.parse(l.detail) : null,
        createdAt: l.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("[Admin/AuditLogs] GET error:", error);
    return NextResponse.json(
      { error: "감사 로그 조회 실패" },
      { status: 500 }
    );
  }
}
