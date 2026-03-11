import { prisma } from "@/lib/prisma";
import { SettingsContent } from "@/components/settings/settings-content";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const configs = await prisma.ruleConfig.findMany({
    orderBy: { ruleType: "asc" },
  });

  const serialized = configs.map((c) => ({
    id: c.id,
    ruleType: c.ruleType,
    displayName: c.displayName,
    description: c.description,
    enabled: c.enabled,
    parameters: c.parameters,
  }));

  return <SettingsContent configs={serialized} />;
}
