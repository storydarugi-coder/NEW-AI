"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings, Save, Loader2, CheckCircle } from "lucide-react";

interface RuleConfigItem {
  id: string;
  ruleType: string;
  displayName: string;
  description: string;
  enabled: boolean;
  parameters: string;
}

interface Props {
  configs: RuleConfigItem[];
}

function getRuleIcon(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout": return "🚨";
    case "scaling_recall": return "🦷";
    case "implant_followup": return "🔧";
    case "potential_demand": return "💡";
    default: return "⚙️";
  }
}

function getParamLabel(key: string): string {
  const labels: Record<string, string> = {
    nerve_treatment_days: "신경치료 중단 판정 기준 (일)",
    prosthetic_days: "보철 중단 판정 기준 (일)",
    scaling_months: "스케일링 리콜 주기 (개월)",
    perio_recall_months: "치주 리콜 주기 (개월)",
    implant_checkup_months: "임플란트 점검 시점 (개월, 쉼표 구분)",
  };
  return labels[key] || key;
}

export function SettingsContent({ configs: initialConfigs }: Props) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  async function handleToggle(id: string, enabled: boolean) {
    setConfigs((prev) =>
      prev.map((c) => (c.id === id ? { ...c, enabled } : c))
    );
    await saveConfig(id, { enabled });
  }

  async function handleParamChange(id: string, paramKey: string, value: string) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const params = JSON.parse(c.parameters);
        // Handle array values (implant_checkup_months)
        if (paramKey === "implant_checkup_months") {
          params[paramKey] = value.split(",").map((v) => parseInt(v.trim())).filter((v) => !isNaN(v));
        } else {
          params[paramKey] = parseInt(value) || 0;
        }
        return { ...c, parameters: JSON.stringify(params) };
      })
    );
  }

  async function saveConfig(id: string, overrides?: { enabled?: boolean }) {
    setSaving(id);
    const config = configs.find((c) => c.id === id);
    if (!config) return;

    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          enabled: overrides?.enabled ?? config.enabled,
          parameters: config.parameters,
        }),
      });
      setSaved(id);
      setTimeout(() => setSaved(null), 2000);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">
          규칙 엔진의 동작을 조정하고 파라미터를 설정합니다
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <Settings size={14} className="inline mr-1.5 -mt-0.5" />
          각 규칙의 파라미터를 수정하면 대시보드와 환자 분석에 즉시 반영됩니다.
          규칙을 비활성화하면 해당 유형의 탐지가 중단됩니다.
        </p>
      </div>

      <div className="space-y-4">
        {configs.map((config) => {
          const params = JSON.parse(config.parameters);
          const paramKeys = Object.keys(params);

          return (
            <Card key={config.id} className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{getRuleIcon(config.ruleType)}</span>
                    <div>
                      <CardTitle className="text-base">{config.displayName}</CardTitle>
                      <p className="text-sm text-gray-500 mt-0.5">{config.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        config.enabled
                          ? "bg-green-50 text-green-700 border-green-200"
                          : "bg-gray-50 text-gray-500 border-gray-200"
                      }
                    >
                      {config.enabled ? "활성" : "비활성"}
                    </Badge>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) => handleToggle(config.id, checked)}
                    />
                  </div>
                </div>
              </CardHeader>
              {config.enabled && paramKeys.length > 0 && (
                <CardContent className="pt-0 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {paramKeys.map((key) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Label className="text-sm text-gray-600 sm:w-64 shrink-0">
                          {getParamLabel(key)}
                        </Label>
                        <Input
                          type="text"
                          value={
                            Array.isArray(params[key])
                              ? params[key].join(", ")
                              : String(params[key])
                          }
                          onChange={(e) => handleParamChange(config.id, key, e.target.value)}
                          className="sm:w-48"
                        />
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button
                        size="sm"
                        onClick={() => saveConfig(config.id)}
                        disabled={saving === config.id}
                      >
                        {saving === config.id ? (
                          <Loader2 size={14} className="animate-spin mr-1" />
                        ) : saved === config.id ? (
                          <CheckCircle size={14} className="mr-1 text-green-500" />
                        ) : (
                          <Save size={14} className="mr-1" />
                        )}
                        {saved === config.id ? "저장 완료" : "저장"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {/* Disclaimer */}
      <Card className="border-0 shadow-sm bg-amber-50/50">
        <CardContent className="p-4">
          <p className="text-xs text-amber-700">
            ⚕️ 본 시스템은 병원 운영 보조 도구로, 설정값은 운영 편의를 위한 것이며
            의료적 판단 기준이 아닙니다. 실제 환자 관리는 의료진의 전문적 판단에 따라 진행해 주세요.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
