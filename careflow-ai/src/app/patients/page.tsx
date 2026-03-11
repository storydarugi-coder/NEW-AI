import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { PatientListContent } from "@/components/patients/patient-list-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
  try {
    const ruleConfigs = await prisma.ruleConfig.findMany();
    const engineConfig = buildEngineConfig(ruleConfigs);

    const patients = await prisma.patient.findMany({
      include: {
        visits: {
          include: { procedures: true, diagnoses: true },
          orderBy: { visitDate: "desc" },
        },
      },
      orderBy: { name: "asc" },
    });

    if (patients.length === 0) {
      return <DbUnavailable reason="empty" />;
    }

    const detectionMap = evaluateAllPatients(patients, engineConfig);

    const patientList = patients.map((patient) => {
      const detections = detectionMap.get(patient.id) || [];
      return {
        id: patient.id,
        chartNumber: patient.chartNumber,
        name: patient.name,
        gender: patient.gender,
        birthYear: patient.birthYear,
        phone: patient.phone,
        isVip: patient.isVip,
        lastVisitDate: patient.visits[0]?.visitDate.toISOString() || null,
        visitCount: patient.visits.length,
        detections: detections.map((d) => ({
          ruleType: d.ruleType,
          subType: d.subType,
          priority: d.priority,
          reason: d.reason,
        })),
        topPriority: detections.length > 0 ? Math.min(...detections.map((d) => d.priority)) : 99,
      };
    });

    return <PatientListContent patients={patientList} />;
  } catch (error) {
    console.error("[CareFlow] 환자 목록 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
