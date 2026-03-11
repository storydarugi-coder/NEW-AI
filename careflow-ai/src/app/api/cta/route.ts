import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    // CTA 유입 방문 + 귀속 정보 + 환자 정보
    const attributions = await prisma.leadAttribution.findMany({
      include: {
        visit: {
          include: {
            patient: {
              include: { identity: true },
            },
          },
        },
        campaign: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const leads = attributions.map((a) => ({
      id: a.id,
      visitId: a.visitId,
      visitDate: a.visit.visitDate.toISOString(),
      patientId: a.visit.patientId,
      patientName: a.visit.patient.identity?.name || a.visit.patient.chartNumber,
      chartNumber: a.visit.patient.chartNumber,
      isVip: a.visit.patient.isVip,
      channel: a.visit.channel,
      sourceRaw: a.visit.sourceRaw,
      campaignId: a.campaignId,
      campaignName: a.campaign.name,
      platform: a.campaign.platform,
      reviewStatus: a.reviewStatus,
      autoReason: a.autoReason,
      confidence: a.confidence,
      reviewer: a.reviewer,
      reviewedAt: a.reviewedAt?.toISOString() || null,
      reviewMemo: a.reviewMemo,
    }));

    // 캠페인별 집계
    const campaigns = await prisma.campaign.findMany({
      include: {
        leadAttributions: true,
      },
    });

    const campaignStats = campaigns.map((c) => {
      const total = c.leadAttributions.length;
      const confirmed = c.leadAttributions.filter((a) => a.reviewStatus === "confirmed").length;
      const pending = c.leadAttributions.filter((a) => a.reviewStatus === "pending").length;
      const rejected = c.leadAttributions.filter((a) => a.reviewStatus === "rejected").length;

      return {
        id: c.id,
        name: c.name,
        platform: c.platform,
        adType: c.adType,
        status: c.status,
        startDate: c.startDate.toISOString(),
        endDate: c.endDate?.toISOString() || null,
        budgetWon: c.budgetWon,
        costPerClick: c.costPerClick,
        totalLeads: total,
        confirmedLeads: confirmed,
        pendingLeads: pending,
        rejectedLeads: rejected,
        // 정산 가능 환자 수 = confirmed
        settlementCount: confirmed,
      };
    });

    // 전체 요약
    const summary = {
      totalLeads: leads.length,
      pendingReview: leads.filter((l) => l.reviewStatus === "pending").length,
      confirmed: leads.filter((l) => l.reviewStatus === "confirmed").length,
      rejected: leads.filter((l) => l.reviewStatus === "rejected").length,
      activeCampaigns: campaigns.filter((c) => c.status === "active").length,
    };

    return NextResponse.json({ leads, campaignStats, summary });
  } catch (error) {
    console.error("CTA API error:", error);
    return NextResponse.json(
      { error: "CTA 데이터를 불러오는 중 오류가 발생했습니다." },
      { status: 500 }
    );
  }
}
