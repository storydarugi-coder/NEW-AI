import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";
import { collectOutcomeMetrics } from "@/lib/ai/outcome";

/**
 * GET /api/reports/export?type=cta_settlement|message_status|unclassified|outcome|period_summary
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

      case "outcome": {
        const windowDays = parseInt(sp.get("windowDays") || "30", 10);
        const metrics = await collectOutcomeMetrics(from, to, windowDays);
        const periodLabel = `${from.toISOString().split("T")[0]} ~ ${to.toISOString().split("T")[0]}`;

        fileName = `outcome-report-${sp.get("period") || "custom"}.csv`;
        csvContent = "구분,항목,발송,재내원,전환율(%),비고\n";
        csvContent += `전체,종합,${metrics.totalSent},${metrics.totalRevisited},${metrics.conversionRate},${periodLabel}\n`;
        csvContent += `전체,귀속윈도우,,,,"${windowDays}일"\n`;
        csvContent += `전체,평균재내원소요일,,,,"${metrics.avgDaysToRevisit ?? "-"}일"\n`;

        const typeLabels: Record<string, string> = {
          RECALL: "리콜", CTA_FOLLOWUP: "CPA 후속", TREATMENT_RESUME: "치료 복귀",
          COUNSELING_FOLLOWUP: "상담 후속", SCALING_REMINDER: "스케일링 안내", GENERAL: "일반",
        };
        for (const [type, data] of Object.entries(metrics.byMessageType)) {
          csvContent += `메시지유형,${typeLabels[type] || type},${data.sent},${data.revisited},${data.rate},\n`;
        }

        const genLabels: Record<string, string> = {
          ai: "AI 생성", gemini: "AI 생성", template: "템플릿", fallback: "폴백", unknown: "미분류",
        };
        for (const [genBy, data] of Object.entries(metrics.byGeneratedBy)) {
          csvContent += `생성방식,${genLabels[genBy] || genBy},${data.sent},${data.revisited},${data.rate},\n`;
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
        csvContent += `CPA 유입,${ctaCount}\n`;
        csvContent += `CPA 확정,${ctaConfirmed}\n`;
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
