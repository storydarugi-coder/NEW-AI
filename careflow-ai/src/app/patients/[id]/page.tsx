import { prisma } from "@/lib/prisma";
import { evaluatePatient, buildEngineConfig } from "@/lib/engine";
import { PatientDetailContent } from "@/components/patients/patient-detail-content";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: PageProps) {
  const { id } = await params;

  const patient = await prisma.patient.findUnique({
    where: { id },
    include: {
      visits: {
        include: { procedures: true, diagnoses: true },
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
      name: patient.name,
      gender: patient.gender,
      birthYear: patient.birthYear,
      phone: patient.phone,
      isVip: patient.isVip,
      memo: patient.memo,
    },
    visits: patient.visits.map((v) => ({
      id: v.id,
      visitDate: v.visitDate.toISOString(),
      memo: v.memo,
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
}
