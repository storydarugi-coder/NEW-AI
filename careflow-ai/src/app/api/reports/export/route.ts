import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";

/**
 * GET /api/reports/export?type=cta_settlement|message_status|unclassified|period_summary
 * CSV 내보내기
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const exportType = sp.get("type") || "period_summary";
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));
    const dateFilter = { gte: from, lte: to };

    let csvContent = "";
    let fileName = "";

    switch (exportType) {
      case "cta_settlement": {
        fileName = "cta_settlement_report.csv";
        const attributions = await prisma.leadAttribution.findMany({
          where: { createdAt: dateFilter },
          include: {
            visit: { include: { patient: { include: { identity: true } } } },
            campaign: true,
          },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "방문일,차트번호,환자명,캠페인,플랫폼,검토상태,진료개시,정산대상,정산월,미인정사유\n";
        for (const a of attributions) {
          const p = a.visit.patient;
          const name = p.identity?.name || p.chartNumber;
          csvContent += [
            a.visit.visitDate.toISOString().split("T")[0],
            p.chartNumber,
            name,
            a.campaign.name,
            a.campaign.platform,
            a.reviewStatus === "confirmed" ? "확정" : a.reviewStatus === "rejected" ? "반려" : "검토중",
            a.treatmentStarted ? "Y" : "N",
            a.settlementEligible ? "Y" : "N",
            a.settlementMonth || "",
            a.ineligibleReason || "",
          ].join(",") + "\n";
        }
        break;
      }

      case "message_status": {
        fileName = "message_status_report.csv";
        const messages = await prisma.outboundMessage.findMany({
          where: { createdAt: dateFilter },
          include: { patient: { include: { identity: true } } },
          orderBy: { createdAt: "desc" },
        });

        csvContent = "생성일,차트번호,환자명,메시지유형,채널,승인상태,발송상태,차단여부,차단사유\n";
        for (const m of messages) {
          const name = m.patient.identity?.name || m.patient.chartNumber;
          let blockReason = "";
          if (m.doNotContactBlocked) blockReason = "수신거부";
          else if (m.duplicateBlocked) blockReason = `중복(${m.duplicateReason || ""})`;

          csvContent += [
            m.createdAt.toISOString().split("T")[0],
            m.patient.chartNumber,
            name,
            m.messageType,
            m.channel,
            m.approvalStatus,
            m.sendStatus,
            m.doNotContactBlocked || m.duplicateBlocked ? "Y" : "N",
            blockReason,
          ].join(",") + "\n";
        }
        break;
      }

      case "unclassified": {
        fileName = "unclassified_sources.csv";
        const visits = await prisma.visit.findMany({
          where: {
            visitDate: dateFilter,
            OR: [
              { normalizedSource: "Unknown" },
              { matchConfidence: "LOW" },
              { sourceReviewStatus: "unreviewed" },
            ],
          },
          include: { patient: true },
          orderBy: { visitDate: "desc" },
          take: 1000,
        });

        csvContent = "방문일,차트번호,원문경로,정규화소스,카테고리,신뢰도,검토상태\n";
        for (const v of visits) {
          csvContent += [
            v.visitDate.toISOString().split("T")[0],
            v.patient.chartNumber,
            `"${(v.sourceRaw || "").replace(/"/g, '""')}"`,
            v.normalizedSource || "미분류",
            v.sourceCategory || "",
            v.matchConfidence || "",
            v.sourceReviewStatus,
          ].join(",") + "\n";
        }
        break;
      }

      case "period_summary":
      default: {
        fileName = "period_summary_report.csv";

        const [visitCount, patientCount, ctaCount, ctaConfirmed, msgSent, msgFailed, tasksCompleted, tasksCreated] = await Promise.all([
          prisma.visit.count({ where: { visitDate: dateFilter } }),
          prisma.patient.count({ where: { createdAt: dateFilter } }),
          prisma.leadAttribution.count({ where: { createdAt: dateFilter } }),
          prisma.leadAttribution.count({ where: { reviewStatus: "confirmed", createdAt: dateFilter } }),
          prisma.outboundMessage.count({ where: { sendStatus: "SENT", createdAt: dateFilter } }),
          prisma.outboundMessage.count({ where: { sendStatus: { in: ["FAILED", "RETRY_NEEDED"] }, createdAt: dateFilter } }),
          prisma.workflowTask.count({ where: { completedAt: dateFilter } }),
          prisma.workflowTask.count({ where: { createdAt: dateFilter } }),
        ]);

        csvContent = "지표,값\n";
        csvContent += `기간 시작,${from.toISOString().split("T")[0]}\n`;
        csvContent += `기간 종료,${to.toISOString().split("T")[0]}\n`;
        csvContent += `방문 수,${visitCount}\n`;
        csvContent += `신규 환자,${patientCount}\n`;
        csvContent += `CTA 유입,${ctaCount}\n`;
        csvContent += `CTA 확정,${ctaConfirmed}\n`;
        csvContent += `메시지 발송,${msgSent}\n`;
        csvContent += `메시지 실패,${msgFailed}\n`;
        csvContent += `업무 생성,${tasksCreated}\n`;
        csvContent += `업무 완료,${tasksCompleted}\n`;
        break;
      }
    }

    // BOM for Excel UTF-8 compatibility
    const bom = "\uFEFF";
    return new NextResponse(bom + csvContent, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (error) {
    console.error("[Reports] CSV 내보내기 실패:", error);
    return NextResponse.json({ error: "CSV 내보내기 실패" }, { status: 500 });
  }
}
