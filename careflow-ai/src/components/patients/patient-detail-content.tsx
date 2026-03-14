"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Star,
  AlertTriangle,
  Calendar,
  Phone,
  FileText,
  MessageSquare,
  Info,
  Loader2,
  RefreshCw,
  Check,
  Clock,
  XCircle,
  Sparkles,
  FileCode,
  Bot,
  Send,
  Megaphone,
  ClipboardList,
} from "lucide-react";
import { TaskPanel } from "@/components/workflow/task-panel";
import {
  RULE_TYPE_LABELS,
  SUB_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TONE_LABELS,
  CHANNEL_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  type RuleType,
  type SubType,
  type Priority,
  type MessageTone,
  type VisitChannel,
  type AttributionReviewStatus,
} from "@/types";
import { maskName, maskPhone } from "@/lib/privacy";

interface Detection {
  ruleType: string;
  subType: string;
  priority: number;
  reason: string;
  evidenceDate: string | null;
  evidenceDetail: string;
  dueDate: string | null;
}

interface VisitAttribution {
  reviewStatus: string;
  campaignName: string;
  autoReason: string | null;
  confidence: number | null;
}

interface Visit {
  id: string;
  visitDate: string;
  memo: string | null;
  channel: string | null;
  isCta: boolean;
  sourceRaw: string | null;
  procedures: { code: string; name: string; tooth: string | null }[];
  diagnoses: { code: string; name: string; tooth: string | null }[];
  attribution: VisitAttribution | null;
}

interface MessageDraft {
  id: string;
  tone: string;
  length: string;
  content: string;
  status: string;
  createdAt: string;
}

interface PatientInfo {
  id: string;
  chartNumber: string;
  name: string;
  gender: string;
  birthYear: number;
  phone: string;
  isVip: boolean;
  tags: string | null;
}

interface WorkflowTaskItem {
  id: string;
  actionType: string;
  status: string;
  assigneeId: string | null;
  note: string | null;
  reason: string | null;
  nextFollowUpAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string; role: string } | null;
  activities: {
    id: string;
    action: string;
    fromValue: string | null;
    toValue: string | null;
    detail: string | null;
    createdAt: string;
    staff?: { name: string } | null;
  }[];
}

interface Props {
  data: {
    patient: PatientInfo;
    visits: Visit[];
    detections: Detection[];
    messageDrafts: MessageDraft[];
    workflowTasks: WorkflowTaskItem[];
  };
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function getRuleColor(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout": return "bg-red-100 text-red-700 border-red-200";
    case "scaling_recall": return "bg-amber-100 text-amber-700 border-amber-200";
    case "implant_followup": return "bg-blue-100 text-blue-700 border-blue-200";
    case "potential_demand": return "bg-purple-100 text-purple-700 border-purple-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

// generationType 라벨 + 아이콘 + 색상
// 정규화 로직: src/lib/ai/generation-type.ts의 normalizeGenerationType() 참조
// API는 이미 정규화된 값("ai"|"template"|"fallback")을 반환하지만
// 레거시 데이터 안전성을 위해 "gemini"/"vertex" 키도 유지
const generatedByLabels: Record<string, { label: string; icon: typeof Sparkles; color: string }> = {
  ai: { label: "AI 자동 생성", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
  gemini: { label: "AI 자동 생성", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
  vertex: { label: "AI 자동 생성", icon: Sparkles, color: "text-purple-600 bg-purple-50 border-purple-200" },
  template: { label: "템플릿 생성", icon: FileCode, color: "text-blue-600 bg-blue-50 border-blue-200" },
  fallback: { label: "기본 메시지", icon: Bot, color: "text-gray-600 bg-gray-50 border-gray-200" },
};

const statusActions = [
  { status: "contacted", label: "연락 완료", icon: Check, color: "bg-green-600 hover:bg-green-700" },
  { status: "dismissed", label: "연락 보류", icon: XCircle, color: "bg-gray-500 hover:bg-gray-600" },
  { status: "pending", label: "추후 재확인", icon: Clock, color: "bg-amber-500 hover:bg-amber-600" },
];

export function PatientDetailContent({ data }: Props) {
  const { patient, visits, detections, messageDrafts: initialDrafts, workflowTasks } = data;
  const currentYear = new Date().getFullYear();
  const age = currentYear - patient.birthYear;

  const [selectedTone, setSelectedTone] = useState<MessageTone>("polite");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedMessages, setGeneratedMessages] = useState<{
    shortMessage: string;
    standardMessage: string;
    warmMessage: string;
    generationType: string;
  } | null>(null);
  const [drafts, setDrafts] = useState(initialDrafts);
  const [detectionStatuses, setDetectionStatuses] = useState<Record<string, string>>({});
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [generateError, setGenerateError] = useState<string | null>(null);

  async function generateMessage(detectionIndex: number) {
    setIsGenerating(true);
    setGenerateError(null);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          detectionIndex,
          tone: selectedTone,
        }),
      });
      const result = await res.json();
      if (result.error) {
        setGenerateError(result.error);
        return;
      }
      if (result.messages) {
        setGeneratedMessages({
          shortMessage: result.messages.shortMessage,
          standardMessage: result.messages.standardMessage,
          warmMessage: result.messages.warmMessage,
          generationType: result.generationType || result.generatedBy || "fallback",
        });
        if (result.drafts) {
          const newDrafts = result.drafts.map((d: MessageDraft) => ({
            id: d.id,
            tone: d.tone,
            length: d.length,
            content: d.content,
            status: d.status,
            createdAt: d.createdAt,
          }));
          setDrafts((prev) => [...newDrafts, ...prev]);
        }
      }
    } catch {
      setGenerateError("메시지 생성 중 오류가 발생했습니다.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function updateDetectionStatus(detection: Detection, newStatus: string) {
    const key = `${detection.ruleType}_${detection.subType}`;
    setUpdatingStatus(key);
    try {
      await fetch(`/api/patients/${patient.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ruleType: detection.ruleType,
          subType: detection.subType,
          status: newStatus,
        }),
      });
      setDetectionStatuses((prev) => ({ ...prev, [key]: newStatus }));
    } catch {
      // 에러는 조용히 처리
    } finally {
      setUpdatingStatus(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/hospital/patients" className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            {patient.isVip && <Star size={18} className="text-yellow-500 fill-yellow-500" />}
          </div>
          <p className="text-sm text-gray-500">{patient.chartNumber} · {age}세 · {patient.gender === "M" ? "남" : "여"}</p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { icon: Phone, label: "연락처", value: patient.phone },
          { icon: Calendar, label: "최근 방문", value: formatDate(visits[0]?.visitDate || null) },
          { icon: FileText, label: "방문 횟수", value: `${visits.length}회` },
          { icon: AlertTriangle, label: "알림 수", value: `${detections.length}건` },
        ].map((item, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
                <item.icon size={14} /> {item.label}
              </div>
              <p className="font-medium text-gray-900">{item.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {patient.tags && (
        <Card className="border-0 shadow-sm bg-yellow-50/50">
          <CardContent className="p-4">
            <div className="flex flex-wrap gap-1.5">
              <span className="text-sm font-medium text-gray-600 mr-1">태그:</span>
              {patient.tags.split(",").map((tag, i) => (
                <Badge key={i} variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-200">
                  {tag.trim()}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* CPA 광고 유입 + CRM 통합 요약 */}
      {visits.some((v) => v.isCta) && (
        <Card className="border-0 shadow-sm border-l-4 border-l-green-400">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Megaphone size={16} className="text-green-600" />
                <span className="font-medium text-gray-900">광고 유입 환자</span>
              </div>
              <Link href="/internal/cpa" className="text-xs text-green-600 hover:text-green-700">
                광고 관리 →
              </Link>
            </div>
            <div className="space-y-2">
              {visits.filter((v) => v.isCta).map((v) => (
                <div key={v.id} className="bg-green-50/50 rounded-lg p-3 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm text-gray-700">{formatDate(v.visitDate)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {CHANNEL_LABELS[v.channel as string] || v.channel || "미분류"}
                    </Badge>
                    {v.attribution && (
                      <Badge variant="outline" className={`text-[10px] ${REVIEW_STATUS_COLORS[v.attribution.reviewStatus as AttributionReviewStatus] || ""}`}>
                        {REVIEW_STATUS_LABELS[v.attribution.reviewStatus as AttributionReviewStatus] || v.attribution.reviewStatus}
                      </Badge>
                    )}
                    {v.attribution?.campaignName && (
                      <span className="text-xs text-gray-400">{v.attribution.campaignName}</span>
                    )}
                  </div>
                  {v.sourceRaw && (
                    <p className="text-xs text-gray-500">유입 경로: {v.sourceRaw}</p>
                  )}
                  {v.attribution?.autoReason && (
                    <p className="text-xs text-gray-400">분류 근거: {v.attribution.autoReason}</p>
                  )}
                </div>
              ))}
            </div>

            {/* CRM 연계 요약 */}
            {detections.length > 0 && (
              <div className="border-t pt-3 mt-2">
                <p className="text-xs font-medium text-gray-600 mb-1.5">이 환자의 CRM 상태</p>
                <div className="flex flex-wrap gap-1.5">
                  {detections.map((d, i) => (
                    <Badge key={i} variant="outline" className={`text-[10px] ${getRuleColor(d.ruleType)}`}>
                      {SUB_TYPE_LABELS[d.subType as SubType] || RULE_TYPE_LABELS[d.ruleType as RuleType]}
                    </Badge>
                  ))}
                </div>
                <p className="text-[11px] text-gray-400 mt-1">
                  광고 유입 후 {detections.length}건의 후속 관리가 필요합니다
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="workflow" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="workflow" className="gap-1.5"><ClipboardList size={14} />업무 처리 ({workflowTasks.length})</TabsTrigger>
          <TabsTrigger value="detections" className="gap-1.5"><AlertTriangle size={14} />리콜 추천 ({detections.length})</TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5"><Calendar size={14} />타임라인</TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5"><MessageSquare size={14} />문자 초안 ({drafts.length})</TabsTrigger>
        </TabsList>

        {/* Workflow Tab */}
        <TabsContent value="workflow">
          <TaskPanel patientId={patient.id} patientName={patient.name} initialTasks={workflowTasks} />
        </TabsContent>

        {/* Detections Tab */}
        <TabsContent value="detections" className="space-y-3">
          {detections.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">현재 이 환자에 대한 추천 사항이 없습니다</CardContent>
            </Card>
          )}

          {/* Tone selector */}
          {detections.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">문자 톤:</span>
              <div className="flex gap-1.5">
                {(["polite", "friendly", "doctor"] as MessageTone[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedTone(t)}
                    className={`px-2.5 py-1 rounded-lg text-xs transition-colors ${selectedTone === t ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                  >
                    {TONE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>
          )}

          {detections.map((d, i) => {
            const key = `${d.ruleType}_${d.subType}`;
            const currentStatus = detectionStatuses[key];

            return (
              <Card key={i} className="border-0 shadow-sm">
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={PRIORITY_COLORS[d.priority as Priority]}>{PRIORITY_LABELS[d.priority as Priority]}</Badge>
                        <Badge variant="outline" className={getRuleColor(d.ruleType)}>
                          {SUB_TYPE_LABELS[d.subType as SubType] || RULE_TYPE_LABELS[d.ruleType as RuleType]}
                        </Badge>
                        {currentStatus && (
                          <Badge variant="outline" className={currentStatus === "contacted" ? "bg-green-50 text-green-700 border-green-200" : currentStatus === "dismissed" ? "bg-gray-50 text-gray-500 border-gray-200" : "bg-amber-50 text-amber-700 border-amber-200"}>
                            {currentStatus === "contacted" ? "연락 완료" : currentStatus === "dismissed" ? "연락 보류" : "추후 재확인"}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-gray-900 font-medium">{d.reason}</p>
                      <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                        <div className="flex items-center gap-1 text-xs text-gray-500"><Info size={12} /> 추천 근거</div>
                        <p className="text-xs text-gray-600">{d.evidenceDetail}</p>
                        {d.evidenceDate && <p className="text-xs text-gray-500">근거 날짜: {formatDate(d.evidenceDate)}</p>}
                        {d.dueDate && <p className="text-xs text-gray-500">예정일: {formatDate(d.dueDate)}</p>}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => generateMessage(i)} disabled={isGenerating} className="shrink-0">
                      {isGenerating ? <Loader2 size={14} className="animate-spin mr-1" /> : <MessageSquare size={14} className="mr-1" />}
                      문자 생성
                    </Button>
                  </div>

                  {/* Status Actions */}
                  <div className="flex gap-2 pt-1">
                    {statusActions.map((action) => (
                      <Button
                        key={action.status}
                        size="sm"
                        variant="outline"
                        disabled={updatingStatus === key}
                        onClick={() => updateDetectionStatus(d, action.status)}
                        className={`text-xs ${currentStatus === action.status ? "ring-2 ring-offset-1 ring-blue-400" : ""}`}
                      >
                        <action.icon size={12} className="mr-1" />
                        {action.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {/* Generated Messages (3 versions) */}
          {generateError && (
            <Card className="border-0 shadow-sm border-l-4 border-l-red-300">
              <CardContent className="p-4">
                <p className="text-sm text-red-600">{generateError}</p>
              </CardContent>
            </Card>
          )}

          {generatedMessages && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-medium text-gray-700">생성된 문자 초안 (3가지 버전)</CardTitle>
                  <div className="flex items-center gap-2">
                    {(() => {
                      const info = generatedByLabels[generatedMessages.generationType] || generatedByLabels.fallback;
                      const Icon = info.icon;
                      return (
                        <Badge variant="outline" className={`text-[10px] ${info.color}`}>
                          <Icon size={10} className="mr-1" />{info.label}
                        </Badge>
                      );
                    })()}
                    <Button variant="ghost" size="sm" onClick={() => generateMessage(0)} disabled={isGenerating} className="text-xs">
                      <RefreshCw size={12} className={`mr-1 ${isGenerating ? "animate-spin" : ""}`} />다시 생성
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: "짧은 버전 (SMS용)", content: generatedMessages.shortMessage, bg: "bg-blue-50/50" },
                  { label: "기본 버전", content: generatedMessages.standardMessage, bg: "bg-white" },
                  { label: "따뜻한 버전", content: generatedMessages.warmMessage, bg: "bg-amber-50/30" },
                ].map((msg, i) => (
                  <div key={i} className={`rounded-lg p-3 border ${msg.bg}`}>
                    <p className="text-[10px] text-gray-500 mb-1 font-medium">{msg.label}</p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                  </div>
                ))}
                <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-3 py-2 flex items-start gap-2">
                  <Info size={12} className="text-amber-500 mt-0.5 shrink-0" />
                  <p className="text-[11px] text-amber-700">
                    운영 참고용 초안입니다. 발송 전 반드시 내용을 검토해 주세요. 실제 문자 발송 기능은 추후 제공됩니다.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {isGenerating && !generatedMessages && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 flex flex-col items-center gap-3 text-gray-400">
                <Loader2 size={24} className="animate-spin" />
                <p className="text-sm">문자 초안 생성 중...</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-5">
              {visits.length === 0 ? (
                <p className="text-center py-8 text-gray-400">방문 이력이 없습니다</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />
                  <div className="space-y-6">
                    {visits.map((v, idx) => (
                      <div key={v.id} className="relative pl-10">
                        <div className={`absolute left-2.5 w-3 h-3 rounded-full border-2 border-white ${idx === 0 ? "bg-blue-500" : "bg-gray-300"}`} />
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-sm font-medium ${idx === 0 ? "text-blue-700" : "text-gray-700"}`}>
                              {formatDate(v.visitDate)}
                            </span>
                            {idx === 0 && <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-600 border-blue-200">최근</Badge>}
                            {v.channel && (
                              <Badge variant="outline" className={`text-[10px] ${v.isCta ? "bg-green-50 text-green-700 border-green-200" : ""}`}>
                                {CHANNEL_LABELS[v.channel as VisitChannel] || v.channel}
                              </Badge>
                            )}
                          </div>
                          {v.diagnoses.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {v.diagnoses.map((d, i) => (
                                <Badge key={i} variant="outline" className="text-[10px]">
                                  {d.name}{d.tooth ? ` (${d.tooth}번)` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {v.procedures.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {v.procedures.map((p, i) => (
                                <Badge key={i} variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                                  {p.name}{p.tooth ? ` (${p.tooth}번)` : ""}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {v.memo && <p className="text-xs text-gray-400">{v.memo}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-3">
          {drafts.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                생성된 문자 초안이 없습니다. 리콜 추천 탭에서 문자를 생성해 보세요.
              </CardContent>
            </Card>
          )}
          {drafts.map((m) => (
            <Card key={m.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[11px]">{TONE_LABELS[m.tone as MessageTone]}</Badge>
                    <Badge variant="outline" className="text-[11px]">
                      {m.length === "short" ? "짧은 버전" : m.length === "long" ? "따뜻한 버전" : "기본 버전"}
                    </Badge>
                    <span className="text-xs text-gray-400">{formatDate(m.createdAt)}</span>
                    {m.status === "sent" && <Badge className="bg-green-100 text-green-700 text-[10px]">발송 완료</Badge>}
                    {m.status === "queued" && <Badge className="bg-blue-100 text-blue-700 text-[10px]">발송 대기</Badge>}
                    {m.status === "failed" && <Badge className="bg-red-100 text-red-700 text-[10px]">발송 실패</Badge>}
                  </div>
                  {(m.status === "draft" || m.status === "reviewed") && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={async () => {
                        await fetch("/api/messages/send", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ messageId: m.id, action: "send" }),
                        });
                        setDrafts((prev) => prev.map((d) => d.id === m.id ? { ...d, status: "sent" } : d));
                      }}
                      className="text-xs gap-1"
                    >
                      <Send size={12} /> 발송
                    </Button>
                  )}
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
                <p className="text-[10px] text-amber-600 mt-2">운영 참고용 초안 — 발송 전 반드시 검토하세요</p>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
