import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSessionWithScope } from "@/lib/api-auth";

// shared: 병원(업무 배정)과 내부(동기화 담당자) 양쪽에서 사용하므로 productArea 제한 없음
export async function GET() {
  try {
    const { scope, error } = await requireSessionWithScope();
    if (error) return error;
    const staff = await prisma.staff.findMany({
      where: { isActive: true, ...scope },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "담당자 목록을 불러올 수 없습니다." }, { status: 500 });
  }
}
