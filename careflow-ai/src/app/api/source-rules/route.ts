import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SOURCE_RULES } from "@/lib/attribution/rules";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * 분류 규칙 사전 API
 * GET  /api/source-rules — 규칙 목록 조회
 * POST /api/source-rules — 새 규칙 추가
 */

export async function GET() {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const dbRules = await prisma.sourceRule.findMany({
      orderBy: { priority: "asc" },
    });

    // DB에 규칙이 없으면 기본 규칙 반환
    if (dbRules.length === 0) {
      return NextResponse.json({
        rules: DEFAULT_SOURCE_RULES.map((r, i) => ({
          id: `default-${i}`,
          ...r,
          keywords: JSON.stringify(r.keywords),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isDefault: true,
        })),
        isDefault: true,
      });
    }

    return NextResponse.json({
      rules: dbRules.map((r) => ({ ...r, isDefault: false })),
      isDefault: false,
    });
  } catch (error) {
    console.error("Source rules GET error:", error);
    return NextResponse.json(
      { error: "분류 규칙을 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const body = await request.json();
    const { ruleName, keywords, normalizedSource, sourceCategory, ctaCandidate, priority, description } = body;

    if (!ruleName || !keywords || !normalizedSource || !sourceCategory) {
      return NextResponse.json(
        { error: "ruleName, keywords, normalizedSource, sourceCategory는 필수 항목입니다." },
        { status: 400 }
      );
    }

    // keywords 유효성 검증
    let parsedKeywords: string[];
    try {
      parsedKeywords = typeof keywords === "string" ? JSON.parse(keywords) : keywords;
      if (!Array.isArray(parsedKeywords) || parsedKeywords.length === 0) {
        throw new Error("keywords must be a non-empty array");
      }
    } catch {
      return NextResponse.json(
        { error: "keywords는 문자열 배열 형태여야 합니다. 예: [\"키워드1\", \"키워드2\"]" },
        { status: 400 }
      );
    }

    const rule = await prisma.sourceRule.create({
      data: {
        ruleName,
        keywords: JSON.stringify(parsedKeywords),
        normalizedSource,
        sourceCategory,
        ctaCandidate: ctaCandidate ?? false,
        priority: priority ?? 100,
        isActive: true,
        description: description || null,
      },
    });

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error("Source rules POST error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json(
        { error: "이미 같은 이름의 규칙이 존재합니다." },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "규칙 추가 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
