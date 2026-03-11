import { prisma } from "@/lib/prisma";
import { CtaContent } from "@/components/cta/cta-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export const dynamic = "force-dynamic";

export default async function CtaPage() {
  try {
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

    const campaigns = await prisma.campaign.findMany({
      include: {
        leadAttributions: true,
      },
      orderBy: { startDate: "desc" },
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
      };
    });

    return <CtaContent leads={leads} campaignStats={campaignStats} />;
  } catch (error) {
    console.error("[CareFlow] CTA 페이지 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
