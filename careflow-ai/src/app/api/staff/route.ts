import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const staff = await prisma.staff.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(staff);
  } catch {
    return NextResponse.json({ error: "담당자 목록을 불러올 수 없습니다." }, { status: 500 });
  }
}
