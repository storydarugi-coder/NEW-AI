import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";
import { PatientDetailContent } from "@/components/patients/patient-detail-content";
import { notFound } from "next/navigation";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: PageProps) {
  try {
    const { id } = await params;

    const patient = await prisma.patient.findUnique({
      where: { id },
      include: {
        identity: true,
        visits: {
          include: {
            procedures: true,
            diagnoses: true,
            leadAttribution: {
              include: { campaign: true },
            },
          },
          orderBy: { visitDate: "desc" },
        },
        messageDrafts: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!patient) {
      notFound();
    }

    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);
    const detections = evaluatePatient(patient, engineConfig);

    const serialized = {
      patient: {
        id: patient.id,
        chartNumber: patient.chartNumber,
        name: patient.identity?.name || patient.chartNumber,
        gender: patient.gender,
        birthYear: patient.birthYear,
        phone: patient.identity?.phone || "",
        isVip: patient.isVip,
        tags: patient.tags,
      },
      visits: patient.visits.map((v) => ({
        id: v.id,
        visitDate: v.visitDate.toISOString(),
        memo: v.memo,
        channel: v.channel,
        isCta: v.isCta,
        sourceRaw: v.sourceRaw,
        procedures: v.procedures.map((p) => ({
          code: p.code,
          name: p.name,
          tooth: p.tooth,
        })),
        diagnoses: v.diagnoses.map((d) => ({
          code: d.code,
          name: d.name,
          tooth: d.tooth,
        })),
        attribution: v.leadAttribution ? {
          reviewStatus: v.leadAttribution.reviewStatus,
          campaignName: v.leadAttribution.campaign.name,
          autoReason: v.leadAttribution.autoReason,
          confidence: v.leadAttribution.confidence,
        } : null,
      })),
      detections: detections.map((d) => ({
        ruleType: d.ruleType,
        subType: d.subType,
        priority: d.priority,
        reason: d.reason,
        evidenceDate: d.evidenceDate?.toISOString() || null,
        evidenceDetail: d.evidenceDetail,
        dueDate: d.dueDate?.toISOString() || null,
      })),
      messageDrafts: patient.messageDrafts.map((m) => ({
        id: m.id,
        tone: m.tone,
        length: m.length,
        content: m.content,
        status: m.status,
        createdAt: m.createdAt.toISOString(),
      })),
    };

    return <PatientDetailContent data={serialized} />;
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest: string }).digest).includes("NEXT_NOT_FOUND")
    ) {
      throw error;
    }
    console.error("[CareFlow] 환자 상세 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
