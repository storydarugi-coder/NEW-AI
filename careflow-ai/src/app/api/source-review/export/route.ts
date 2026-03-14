import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * 유입 경로 검토 CSV Export
 *
 * GET /api/source-review/export?filter=unreviewed|low_confidence|unclassified|all
 */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const filter = searchParams.get("filter") || "all";

    const where: Record<string, unknown> = {
      sourceRaw: { not: null },
    };

    if (filter === "unreviewed") {
      where.sourceReviewStatus = "unreviewed";
    } else if (filter === "low_confidence") {
      where.matchConfidence = "LOW";
    } else if (filter === "unclassified") {
      where.normalizedSource = "Unknown";
    }

    const visits = await prisma.visit.findMany({
      where,
      include: {
        patient: { select: { chartNumber: true } },
      },
      orderBy: { visitDate: "desc" },
      take: 5000,
    });

    // CSV 헤더
    const headers = [
      "차트번호",
      "방문일",
      "원문경로(sourceRaw)",
      "시스템추천(normalizedSource)",
      "카테고리",
      "CTA후보",
      "신뢰도",
      "검토상태",
      "최종확정소스",
      "최종확정카테고리",
      "최종확정CTA",
      "검토자",
      "검토일시",
      "검토메모",
    ];

    const csvLines = [headers.join(",")];

    for (const v of visits) {
      const row = [
        v.patient.chartNumber,
        v.visitDate.toISOString().split("T")[0],
        `"${(v.sourceRaw || "").replace(/"/g, '""')}"`,
        v.normalizedSource || "",
        v.sourceCategory || "",
        v.ctaCandidate ? "Y" : "N",
        v.matchConfidence || "",
        v.sourceReviewStatus,
        v.reviewedSource || "",
        v.reviewedCategory || "",
        v.reviewedCtaFlag != null ? (v.reviewedCtaFlag ? "Y" : "N") : "",
        v.sourceReviewedBy || "",
        v.sourceReviewedAt ? v.sourceReviewedAt.toISOString().split("T")[0] : "",
        `"${(v.sourceReviewMemo || "").replace(/"/g, '""')}"`,
      ];
      csvLines.push(row.join(","));
    }

    const csvContent = "\uFEFF" + csvLines.join("\n"); // BOM for Excel

    return new NextResponse(csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="source-review-${filter}-${new Date().toISOString().split("T")[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error("Source review export error:", error);
    return NextResponse.json(
      { error: "CSV 내보내기 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
