import { prisma } from "@/lib/prisma";
import { evaluateAllPatients, buildEngineConfig } from "@/lib/engine";
import { PatientListContent } from "@/components/patients/patient-list-content";

export const dynamic = "force-dynamic";

export default async function PatientsPage() {
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
}
