import { prisma } from "@/lib/prisma";
import { SettingsContent } from "@/components/settings/settings-content";
import { DbUnavailable } from "@/components/shared/db-unavailable";

export default async function SettingsPage() {
  try {
    const configs = await prisma.ruleConfig.findMany({
      orderBy: { ruleType: "asc" },
    });

    if (configs.length === 0) {
      return <DbUnavailable reason="empty" />;
    }

    const serialized = configs.map((c) => ({
      id: c.id,
      ruleType: c.ruleType,
      displayName: c.displayName,
      description: c.description,
      enabled: c.enabled,
      parameters: c.parameters,
    }));

    return <SettingsContent configs={serialized} />;
  } catch (error) {
    console.error("[CareFlow] 설정 로드 실패:", error);
    return <DbUnavailable reason="connection" />;
  }
}
