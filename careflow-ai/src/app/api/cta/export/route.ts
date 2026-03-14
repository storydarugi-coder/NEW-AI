import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { maskName } from "@/lib/privacy";
import { CHANNEL_LABELS, REVIEW_STATUS_LABELS } from "@/types";
import { requireSession, requireProductArea } from "@/lib/api-auth";

/**
 * CTA 정산 대상 CSV 내보내기
 * GET /api/cta/export?month=YYYY-MM
 */
export async function GET(request: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM 또는 "all"

    const attributions = await prisma.leadAttribution.findMany({
      where: month && month !== "all" ? { settlementMonth: month } : undefined,
      include: {
        visit: {
          include: {
            patient: { include: { identity: true } },
            procedures: true,
          },
        },
        campaign: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // CSV 헤더
    const headers = [
      "차트번호",
      "환자(마스킹)",
      "방문일",
      "방문경로 원문",
      "정규화 소스(추천)",
      "최종 확정 소스",
      "소스 카테고리",
      "매칭 신뢰도",
      "표준 채널",
      "캠페인명",
      "플랫폼",
      "검토 상태",
      "검토자",
      "검토일",
      "진료 시작 여부",
      "중복 여부",
      "정산 대상",
      "정산 월",
      "미인정 사유",
      "자동분류 근거",
      "분류 신뢰도",
      "처치 코드",
    ];

    const rows = attributions.map((a) => {
      const patient = a.visit.patient;
      const identity = patient.identity;
      return [
        patient.chartNumber,
        identity ? maskName(identity.name) : patient.chartNumber,
        a.visit.visitDate.toISOString().split("T")[0],
        escCsv(a.visit.sourceRaw || ""),
        escCsv(a.visit.normalizedSource || ""),
        escCsv(a.visit.reviewedSource || a.visit.normalizedSource || ""),
        escCsv(a.visit.reviewedCategory || a.visit.sourceCategory || ""),
        a.visit.matchConfidence || "",
        CHANNEL_LABELS[a.visit.channel || "unknown"] || a.visit.channel || "",
        escCsv(a.campaign.name),
        a.campaign.platform,
        REVIEW_STATUS_LABELS[a.reviewStatus as keyof typeof REVIEW_STATUS_LABELS] || a.reviewStatus,
        a.reviewer || "",
        a.reviewedAt ? a.reviewedAt.toISOString().split("T")[0] : "",
        a.treatmentStarted ? "Y" : "N",
        a.isDuplicate ? "Y" : "N",
        a.settlementEligible ? "Y" : "N",
        a.settlementMonth || "",
        escCsv(a.ineligibleReason || ""),
        escCsv(a.autoReason || ""),
        a.confidence != null ? `${Math.round(a.confidence * 100)}%` : "",
        a.visit.procedures.map((p) => p.name).join("; "),
      ];
    });

    // BOM + CSV 생성
    const BOM = "\uFEFF";
    const csv = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

    // 감사 로그
    await prisma.auditLog.create({
      data: {
        action: "export_data",
        entityType: "cta_settlement",
        entityId: month || "all",
        detail: JSON.stringify({ rowCount: rows.length, month }),
      },
    });

    const filename = `cta-settlement-${month || "all"}-${new Date().toISOString().split("T")[0]}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("CTA export error:", error);
    return NextResponse.json(
      { error: "CSV 내보내기 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}

/** CSV 셀 이스케이프: 쉼표, 따옴표, 줄바꿈 포함 시 따옴표로 감쌈 */
function escCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}
