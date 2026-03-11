import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const configs = await prisma.ruleConfig.findMany({
      orderBy: { ruleType: "asc" },
    });
    return NextResponse.json({ configs });
  } catch (error) {
    console.error("Settings GET error:", error);
    return NextResponse.json(
      { error: "설정을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, enabled, parameters } = body as {
      id: string;
      enabled?: boolean;
      parameters?: string;
    };

    if (!id) {
      return NextResponse.json(
        { error: "규칙 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const updateData: { enabled?: boolean; parameters?: string } = {};
    if (typeof enabled === "boolean") updateData.enabled = enabled;
    if (parameters) updateData.parameters = parameters;

    const updated = await prisma.ruleConfig.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ config: updated });
  } catch (error) {
    console.error("Settings PUT error:", error);
    return NextResponse.json(
      { error: "설정 저장 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
