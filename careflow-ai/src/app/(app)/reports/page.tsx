import { prisma } from "@/lib/prisma";
import { ReportsContent } from "@/components/reports/reports-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export default async function ReportsPage() {
  try {
    // DB 연결 확인
    await prisma.$queryRaw`SELECT 1`;
    return <ReportsContent />;
  } catch {
    return <DbUnavailable reason="connection" />;
  }
}
