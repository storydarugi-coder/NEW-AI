import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month"); // YYYY-MM or "all"
    const status = searchParams.get("status"); // pending | confirmed | rejected | all
    const treatmentFilter = searchParams.get("treatment"); // started | not_started | all
    const settlementFilter = searchParams.get("settlement"); // eligible | ineligible | all

    const attributions = await prisma.leadAttribution.findMany({
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

    // 필터
    let filtered = attributions;

    if (month && month !== "all") {
      filtered = filtered.filter((a) => a.settlementMonth === month);
    }
    if (status && status !== "all") {
      filtered = filtered.filter((a) => a.reviewStatus === status);
    }
    if (treatmentFilter === "started") {
      filtered = filtered.filter((a) => a.treatmentStarted);
    } else if (treatmentFilter === "not_started") {
      filtered = filtered.filter((a) => !a.treatmentStarted);
    }
    if (settlementFilter === "eligible") {
      filtered = filtered.filter((a) => a.settlementEligible);
    } else if (settlementFilter === "ineligible") {
      filtered = filtered.filter((a) => !a.settlementEligible);
    }

    // 캠페인별 통계
    const campaigns = await prisma.campaign.findMany({
      include: { leadAttributions: true },
    });

    const campaignStats = campaigns.map((c) => {
      const attrs = month && month !== "all"
        ? c.leadAttributions.filter((a) => a.settlementMonth === month)
        : c.leadAttributions;

      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        status: c.status,
        costPerClick: c.costPerClick,
        budgetWon: c.budgetWon,
        totalLeads: attrs.length,
        confirmed: attrs.filter((a) => a.reviewStatus === "confirmed").length,
        pending: attrs.filter((a) => a.reviewStatus === "pending").length,
        rejected: attrs.filter((a) => a.reviewStatus === "rejected").length,
        treatmentStarted: attrs.filter((a) => a.treatmentStarted).length,
        settlementEligible: attrs.filter((a) => a.settlementEligible).length,
        duplicateCount: attrs.filter((a) => a.isDuplicate).length,
        settlementAmount: attrs.filter((a) => a.settlementEligible).length * (c.costPerClick || 0),
      };
    });

    // 전체 요약 (선택된 월 기준)
    const scopeAttrs = month && month !== "all"
      ? attributions.filter((a) => a.settlementMonth === month)
      : attributions;

    const summary = {
      totalLeads: scopeAttrs.length,
      pending: scopeAttrs.filter((a) => a.reviewStatus === "pending").length,
      confirmed: scopeAttrs.filter((a) => a.reviewStatus === "confirmed").length,
      rejected: scopeAttrs.filter((a) => a.reviewStatus === "rejected").length,
      treatmentStarted: scopeAttrs.filter((a) => a.treatmentStarted).length,
      treatmentNotStarted: scopeAttrs.filter((a) => !a.treatmentStarted).length,
      settlementEligible: scopeAttrs.filter((a) => a.settlementEligible).length,
      duplicateExcluded: scopeAttrs.filter((a) => a.isDuplicate).length,
      totalSettlementAmount: scopeAttrs
        .filter((a) => a.settlementEligible)
        .reduce((sum, a) => {
          const cpc = campaigns.find((c) => c.id === a.campaignId)?.costPerClick || 0;
          return sum + cpc;
        }, 0),
    };

    const availableMonths = [...new Set(
      attributions.map((a) => a.settlementMonth).filter(Boolean) as string[]
    )].sort().reverse();

    const leads = filtered.map((a) => ({
      id: a.id,
      visitId: a.visitId,
      patientId: a.visit.patientId,
      patientName: a.visit.patient.identity?.name || a.visit.patient.chartNumber,
      chartNumber: a.visit.patient.chartNumber,
      visitDate: a.visit.visitDate.toISOString(),
      sourceRaw: a.visit.sourceRaw,
      channel: a.visit.channel,
      campaignId: a.campaignId,
      campaignName: a.campaign.name,
      platform: a.campaign.platform,
      reviewStatus: a.reviewStatus,
      autoReason: a.autoReason,
      confidence: a.confidence,
      reviewer: a.reviewer,
      reviewedAt: a.reviewedAt?.toISOString() || null,
      reviewMemo: a.reviewMemo,
      treatmentStarted: a.treatmentStarted,
      isDuplicate: a.isDuplicate,
      settlementMonth: a.settlementMonth,
      settlementEligible: a.settlementEligible,
      ineligibleReason: a.ineligibleReason,
      procedures: a.visit.procedures.map((p) => ({ code: p.code, name: p.name })),
      // 정규화 정보
      normalizedSource: a.visit.normalizedSource,
      sourceCategory: a.visit.sourceCategory,
      matchConfidence: a.visit.matchConfidence,
      reviewedSource: a.visit.reviewedSource,
      reviewedCategory: a.visit.reviewedCategory,
      sourceReviewStatus: a.visit.sourceReviewStatus,
      finalSource: a.visit.reviewedSource || a.visit.normalizedSource || null,
      finalCategory: a.visit.reviewedCategory || a.visit.sourceCategory || null,
    }));

    return NextResponse.json({ leads, campaignStats, summary, availableMonths });
  } catch (error) {
    console.error("CTA API error:", error);
    return NextResponse.json(
      { error: "CTA 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
