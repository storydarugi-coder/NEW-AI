import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parsePeriod } from "@/lib/reports/period";
import { requireSession, requireProductArea } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

/**
 * GET /api/reports/funnel
 * 운영 퍼널 시각화:
 * CTA 후보 → 검토 → 확정 → 진료개시 → 정산대상 → 후속조치 → 메시지 → 성공
 */
// internal: CTA 유입→정산 퍼널은 내부 운영 도메인
export async function GET(req: NextRequest) {
  try {
    const { session, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(session, "internal");
    if (areaError) return areaError;

    const sp = req.nextUrl.searchParams;
    const { from, to } = parsePeriod(sp.get("period"), sp.get("from"), sp.get("to"));

    const dateFilter = { gte: from, lte: to };

    // tenant 스코핑
    const scope = getTenantScope(session);
    const visitTenant = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};
    const leadTenant = scope.tenantId ? { visit: { patient: { tenantId: scope.tenantId } } } : {};
    const msgTenant = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};
    const taskTenant = scope.tenantId ? { patient: { tenantId: scope.tenantId } } : {};

    // 1. CTA 후보 (방문경로에서 ctaCandidate = true)
    const ctaCandidates = await prisma.visit.count({
      where: { ctaCandidate: true, visitDate: dateFilter, ...visitTenant },
    });

    // 2. 검토 완료 (LeadAttribution 생성됨)
    const reviewed = await prisma.leadAttribution.count({
      where: { createdAt: dateFilter, ...leadTenant },
    });

    // 3. 확정
    const confirmed = await prisma.leadAttribution.count({
      where: { reviewStatus: "confirmed", createdAt: dateFilter, ...leadTenant },
    });

    // 4. 진료 개시
    const treatmentStarted = await prisma.leadAttribution.count({
      where: { treatmentStarted: true, createdAt: dateFilter, ...leadTenant },
    });

    // 5. 정산 대상
    const settlementEligible = await prisma.leadAttribution.count({
      where: { settlementEligible: true, createdAt: dateFilter, ...leadTenant },
    });

    // 6. 후속 조치 (WorkflowTask 생성)
    const followUpTasks = await prisma.workflowTask.count({
      where: { createdAt: dateFilter, ...taskTenant },
    });

    // 7. 메시지 생성
    const messagesCreated = await prisma.outboundMessage.count({
      where: { createdAt: dateFilter, ...msgTenant },
    });

    // 8. 메시지 발송 성공
    const messagesSent = await prisma.outboundMessage.count({
      where: { sendStatus: "SENT", createdAt: dateFilter, ...msgTenant },
    });

    const funnel = [
      { stage: "CTA 후보", count: ctaCandidates, color: "#6366f1" },
      { stage: "검토 완료", count: reviewed, color: "#8b5cf6" },
      { stage: "확정", count: confirmed, color: "#a855f7" },
      { stage: "진료 개시", count: treatmentStarted, color: "#d946ef" },
      { stage: "정산 대상", count: settlementEligible, color: "#ec4899" },
      { stage: "후속 조치", count: followUpTasks, color: "#f43f5e" },
      { stage: "메시지 생성", count: messagesCreated, color: "#f97316" },
      { stage: "발송 성공", count: messagesSent, color: "#22c55e" },
    ];

    return NextResponse.json({
      period: { from: from.toISOString(), to: to.toISOString() },
      funnel,
    });
  } catch (error) {
    console.error("[Reports] 퍼널 조회 실패:", error);
    return NextResponse.json({ error: "퍼널 데이터 조회 실패" }, { status: 500 });
  }
}
