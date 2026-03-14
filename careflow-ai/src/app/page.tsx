import { prisma } from "@/lib/prisma";
import { buildEngineConfig } from "@/lib/engine";
import { calculatePriorityScore, calculateWeeklyChange } from "@/lib/engine/scoring";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";
import { getCachedDashboardEngine } from "@/lib/cache/dashboard-engine";

// 사용자별 세션 데이터가 AuthGate에서 처리되므로 page-level ISR 불가
export const dynamic = "force-dynamic";

interface ScoreFactor {
  label: string;
  score: number;
  reason: string;
}

interface PriorityPatientItem {
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  topPriority: number;
  priorityScore: number;
  scoreFactors: ScoreFactor[];
  lastVisitDate: string | null;
  detections: {
    ruleType: string;
    subType: string;
    priority: number;
    reason: string;
  }[];
}

export default async function DashboardPage() {
  try {
    // 캐시된 엔진 결과 사용 (30초 TTL, DB+엔진 전체 재실행 방지)
    const cached = await getCachedDashboardEngine();

    if (!cached) {
      return <DbUnavailable reason="empty" />;
    }

    const { stats, priorityPatients, urgentPatients, weeklyChanges } = cached;

    return (
      <DashboardContent
        stats={stats}
        weeklyChanges={weeklyChanges}
        urgentPatients={urgentPatients}
        priorityPatients={priorityPatients.slice(0, 20)}
      />
    );
  } catch (error) {
    console.error("[CareFlow] Dashboard 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
