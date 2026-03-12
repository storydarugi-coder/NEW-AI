import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 개별 분류 규칙 CRUD
 * PATCH  /api/source-rules/[id] — 규칙 수정
 * DELETE /api/source-rules/[id] — 규칙 삭제
 */

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { keywords, normalizedSource, sourceCategory, ctaCandidate, priority, isActive, description } = body;

    const data: Record<string, unknown> = {};

    if (keywords !== undefined) {
      let parsed: string[];
      try {
        parsed = typeof keywords === "string" ? JSON.parse(keywords) : keywords;
        if (!Array.isArray(parsed)) throw new Error();
      } catch {
        return NextResponse.json(
          { error: "keywords는 문자열 배열이어야 합니다." },
          { status: 400 }
        );
      }
      data.keywords = JSON.stringify(parsed);
    }
    if (normalizedSource !== undefined) data.normalizedSource = normalizedSource;
    if (sourceCategory !== undefined) data.sourceCategory = sourceCategory;
    if (typeof ctaCandidate === "boolean") data.ctaCandidate = ctaCandidate;
    if (typeof priority === "number") data.priority = priority;
    if (typeof isActive === "boolean") data.isActive = isActive;
    if (description !== undefined) data.description = description;

    if (Object.keys(data).length === 0) {
      return NextResponse.json({ error: "변경할 내용이 없습니다." }, { status: 400 });
    }

    const rule = await prisma.sourceRule.update({
      where: { id },
      data,
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Source rule PATCH error:", error);
    return NextResponse.json(
      { error: "규칙 수정 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.sourceRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Source rule DELETE error:", error);
    return NextResponse.json(
      { error: "규칙 삭제 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
