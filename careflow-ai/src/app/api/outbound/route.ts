import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasCapability } from "@/lib/auth";
import { checkBeforeSend } from "@/lib/messaging/send";
import { requireSession, requireProductArea, guardTenantAccess } from "@/lib/api-auth";
import { getTenantScope } from "@/lib/tenant";

/**
 * 발송 메시지 API
 *
 * GET  /api/outbound — 메시지 목록 조회
 * POST /api/outbound — 메시지 초안 생성
 */

export async function GET(request: NextRequest) {
  try {
    const { session: user, error } = await requireSession();
    if (error) return error;
    const areaError = requireProductArea(user, "hospital");
    if (areaError) return areaError;

    const { searchParams } = new URL(request.url);
    const approvalStatus = searchParams.get("approvalStatus"); // DRAFT, REVIEW_NEEDED, APPROVED, REJECTED
    const sendStatus = searchParams.get("sendStatus"); // PENDING, SCHEDULED, SENT, FAILED, etc.
    const messageType = searchParams.get("messageType");
    const patientId = searchParams.get("patientId");
    const limit = parseInt(searchParams.get("limit") || "50");

    const where: Record<string, unknown> = {};
    if (approvalStatus) where.approvalStatus = approvalStatus;
    if (sendStatus) where.sendStatus = sendStatus;
    if (messageType) where.messageType = messageType;
    if (patientId) where.patientId = patientId;

    // 테넌트 스코프: patient의 tenantId 기준 필터링
    const scope = getTenantScope(user);
    if (scope.tenantId) {
      where.patient = { tenantId: scope.tenantId };
    }

    const messages = await prisma.outboundMessage.findMany({
      where,
      include: {
        patient: { include: { identity: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    const items = messages.map((m) => ({
      id: m.id,
      patientId: m.patientId,
      patientName: m.patient.identity?.name || m.patient.chartNumber,
      chartNumber: m.patient.chartNumber,
      doNotContact: m.patient.doNotContact,
      messageType: m.messageType,
      channel: m.channel,
      draftMessage: m.draftMessage,
      finalMessage: m.finalMessage,
      approvalStatus: m.approvalStatus,
      approvalMemo: m.approvalMemo,
      approvedBy: m.approvedBy,
      approvedAt: m.approvedAt?.toISOString() || null,
      rejectedReason: m.rejectedReason,
      sendStatus: m.sendStatus,
      scheduledAt: m.scheduledAt?.toISOString() || null,
      sentAt: m.sentAt?.toISOString() || null,
      failedAt: m.failedAt?.toISOString() || null,
      failureReason: m.failureReason,
      sendAttemptCount: m.sendAttemptCount,
      duplicateBlocked: m.duplicateBlocked,
      duplicateReason: m.duplicateReason,
      doNotContactBlocked: m.doNotContactBlocked,
      createdBy: m.createdBy,
      sentBy: m.sentBy,
      createdAt: m.createdAt.toISOString(),
    }));

    return NextResponse.json({ items });
  } catch (error) {
    console.error("Outbound GET error:", error);
    return NextResponse.json({ error: "메시지 목록 조회 실패" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session: user, error: authErr } = await requireSession();
    if (authErr) return authErr;
    const ae = requireProductArea(user, "hospital");
    if (ae) return ae;
    if (!hasCapability(user.role, "send_message")) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }

    const body = await request.json();
    const {
      patientId,
      messageType,
      draftMessage,
      relatedTaskId,
      channel,
      templateType,
      scheduledAt,
    } = body as {
      patientId: string;
      messageType: string;
      draftMessage: string;
      relatedTaskId?: string;
      channel?: string;
      templateType?: string;
      scheduledAt?: string;
    };

    if (!patientId || !messageType || !draftMessage) {
      return NextResponse.json(
        { error: "patientId, messageType, draftMessage가 필요합니다." },
        { status: 400 }
      );
    }

    // 환자 존재 확인 + 테넌트 접근 검증
    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) {
      return NextResponse.json({ error: "환자를 찾을 수 없습니다." }, { status: 404 });
    }
    const tenantError = guardTenantAccess(user, patient);
    if (tenantError) return tenantError;

    const msg = await prisma.outboundMessage.create({
      data: {
        patientId,
        messageType,
        draftMessage,
        relatedTaskId: relatedTaskId || null,
        channel: channel || "KAKAO",
        templateType: templateType || null,
        approvalStatus: "REVIEW_NEEDED",
        sendStatus: scheduledAt ? "SCHEDULED" : "PENDING",
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        createdBy: user.name,
      },
    });

    // 수신거부/중복 사전 체크 (경고용)
    let warnings: string[] = [];
    if (patient.doNotContact) {
      warnings.push("수신 거부 환자입니다. 승인하더라도 발송이 차단됩니다.");
    }
    const check = await checkBeforeSend(msg.id);
    if (!check.canSend && check.blockType === "DUPLICATE") {
      warnings.push(check.reason || "중복 발송 위험");
    }

    return NextResponse.json({
      success: true,
      message: msg,
      warnings: warnings.length > 0 ? warnings : undefined,
    });
  } catch (error) {
    console.error("Outbound POST error:", error);
    return NextResponse.json({ error: "메시지 생성 실패" }, { status: 500 });
  }
}
