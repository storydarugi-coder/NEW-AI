import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { attributionId, reviewStatus, reviewer, memo } = body as {
      attributionId: string;
      reviewStatus: "confirmed" | "rejected";
      reviewer?: string;
      memo?: string;
    };

    if (!attributionId || !reviewStatus) {
      return NextResponse.json(
        { error: "attributionId와 reviewStatus가 필요합니다." },
        { status: 400 }
      );
    }

    if (!["confirmed", "rejected"].includes(reviewStatus)) {
      return NextResponse.json(
        { error: "reviewStatus는 confirmed 또는 rejected여야 합니다." },
        { status: 400 }
      );
    }

    const attribution = await prisma.leadAttribution.update({
      where: { id: attributionId },
      data: {
        reviewStatus,
        reviewer: reviewer || "운영자",
        reviewedAt: new Date(),
        reviewMemo: memo || null,
      },
    });

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "review_attribution",
        entityType: "attribution",
        entityId: attributionId,
        detail: JSON.stringify({ reviewStatus, reviewer: reviewer || "운영자" }),
      },
    });

    return NextResponse.json({ success: true, attribution });
  } catch (error) {
    console.error("CTA review error:", error);
    return NextResponse.json(
      { error: "검토 처리 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
