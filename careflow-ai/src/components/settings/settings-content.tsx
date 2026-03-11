"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Save, Loader2, CheckCircle, Sparkles, AlertTriangle } from "lucide-react";
import { TONE_LABELS, type MessageTone } from "@/types";

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
  const [defaultTone, setDefaultTone] = useState<MessageTone>("polite");

  async function handleToggle(id: string, enabled: boolean) {
    setConfigs((prev) => prev.map((c) => (c.id === id ? { ...c, enabled } : c)));
    await saveConfig(id, { enabled });
  }

  async function handleParamChange(id: string, paramKey: string, value: string) {
    setConfigs((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        const params = JSON.parse(c.parameters);
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
    } catch {
      // 에러 조용히 처리
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-sm text-gray-500 mt-1">규칙 엔진 동작과 AI 메시지 생성을 설정합니다</p>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
        <p className="text-sm text-blue-700">
          <Settings size={14} className="inline mr-1.5 -mt-0.5" />
          파라미터를 수정하면 대시보드와 환자 분석에 즉시 반영됩니다.
        </p>
      </div>

      {/* Rule Configs */}
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
                    <Badge variant="outline" className={config.enabled ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}>
                      {config.enabled ? "활성" : "비활성"}
                    </Badge>
                    <Switch checked={config.enabled} onCheckedChange={(checked) => handleToggle(config.id, checked)} />
                  </div>
                </div>
              </CardHeader>
              {config.enabled && paramKeys.length > 0 && (
                <CardContent className="pt-0 space-y-3">
                  <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                    {paramKeys.map((key) => (
                      <div key={key} className="flex flex-col sm:flex-row sm:items-center gap-2">
                        <Label className="text-sm text-gray-600 sm:w-64 shrink-0">{getParamLabel(key)}</Label>
                        <Input
                          type="text"
                          value={Array.isArray(params[key]) ? params[key].join(", ") : String(params[key])}
                          onChange={(e) => handleParamChange(config.id, key, e.target.value)}
                          className="sm:w-48"
                        />
                      </div>
                    ))}
                    <div className="flex justify-end">
                      <Button size="sm" onClick={() => saveConfig(config.id)} disabled={saving === config.id}>
                        {saving === config.id ? <Loader2 size={14} className="animate-spin mr-1" /> : saved === config.id ? <CheckCircle size={14} className="mr-1 text-green-500" /> : <Save size={14} className="mr-1" />}
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

      <Separator />

      {/* Default Tone */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            💬 기본 문자 톤 설정
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {(["polite", "friendly", "doctor"] as MessageTone[]).map((t) => (
              <button
                key={t}
                onClick={() => setDefaultTone(t)}
                className={`px-4 py-2 rounded-lg text-sm transition-colors ${defaultTone === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
              >
                {TONE_LABELS[t]}
              </button>
            ))}
          </div>
          <p className="text-xs text-gray-400 mt-2">문자 생성 시 기본으로 적용되는 톤입니다.</p>
        </CardContent>
      </Card>

      <Separator />

      {/* Vertex AI Config */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles size={18} className="text-purple-600" />
            AI 메시지 생성 설정 (Vertex AI)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
            <p className="text-xs text-purple-700">
              Vertex AI를 사용하면 환자별 맞춤 문자 초안을 AI가 생성합니다.
              설정되지 않으면 템플릿 기반으로 자동 생성됩니다.
            </p>
          </div>

          <div className="space-y-3 bg-gray-50 rounded-lg p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm text-gray-600 sm:w-48 shrink-0">프로바이더</Label>
              <Input value="Vertex AI (Google Gemini)" disabled className="sm:w-64 bg-gray-100" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm text-gray-600 sm:w-48 shrink-0">모델</Label>
              <Input value={process.env.NEXT_PUBLIC_VERTEX_MODEL || "gemini-2.0-flash"} disabled className="sm:w-64 bg-gray-100" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm text-gray-600 sm:w-48 shrink-0">Temperature</Label>
              <Input value="0.7" disabled className="sm:w-32 bg-gray-100" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm text-gray-600 sm:w-48 shrink-0">Max Output Tokens</Label>
              <Input value="1024" disabled className="sm:w-32 bg-gray-100" />
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <Label className="text-sm text-gray-600 sm:w-48 shrink-0">LLM 사용</Label>
              <Badge variant="outline" className={process.env.NEXT_PUBLIC_ENABLE_LLM === "true" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}>
                {process.env.NEXT_PUBLIC_ENABLE_LLM === "true" ? "활성 (Vertex AI)" : "비활성 (템플릿 사용)"}
              </Badge>
            </div>
          </div>

          <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle size={14} className="text-amber-600 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-700">
              <p className="font-medium mb-1">환경변수 설정 안내</p>
              <p>AI 메시지 생성을 활성화하려면 <code className="bg-amber-100 px-1 rounded">.env</code> 파일에 아래 변수를 설정하세요:</p>
              <pre className="mt-1 bg-amber-100/50 p-2 rounded text-[11px] overflow-x-auto">
{`ENABLE_LLM_MESSAGE_GENERATION=true
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1
VERTEX_MODEL=gemini-2.0-flash`}
              </pre>
              <p className="mt-1">인증: <code className="bg-amber-100 px-1 rounded">gcloud auth login</code> 또는 <code className="bg-amber-100 px-1 rounded">GOOGLE_APPLICATION_CREDENTIALS</code> 환경변수 설정</p>
            </div>
          </div>
        </CardContent>
      </Card>

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
