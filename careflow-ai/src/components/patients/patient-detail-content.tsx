"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
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
} from "lucide-react";
import {
  RULE_TYPE_LABELS,
  SUB_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  TONE_LABELS,
  LENGTH_LABELS,
  type RuleType,
  type SubType,
  type Priority,
  type MessageTone,
  type MessageLength,
} from "@/types";

interface Detection {
  ruleType: string;
  subType: string;
  priority: number;
  reason: string;
  evidenceDate: string | null;
  evidenceDetail: string;
  dueDate: string | null;
}

interface Visit {
  id: string;
  visitDate: string;
  memo: string | null;
  procedures: { code: string; name: string; tooth: string | null }[];
  diagnoses: { code: string; name: string; tooth: string | null }[];
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
  memo: string | null;
}

interface Props {
  data: {
    patient: PatientInfo;
    visits: Visit[];
    detections: Detection[];
    messageDrafts: MessageDraft[];
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

export function PatientDetailContent({ data }: Props) {
  const { patient, visits, detections, messageDrafts: initialDrafts } = data;
  const currentYear = new Date().getFullYear();
  const age = currentYear - patient.birthYear;

  const [selectedTone, setSelectedTone] = useState<MessageTone>("polite");
  const [selectedLength, setSelectedLength] = useState<MessageLength>("medium");
  const [generatedMessage, setGeneratedMessage] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [drafts, setDrafts] = useState(initialDrafts);

  async function generateMessage(detectionIndex: number) {
    setIsGenerating(true);
    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          patientId: patient.id,
          detectionIndex,
          tone: selectedTone,
          length: selectedLength,
        }),
      });
      const result = await res.json();
      if (result.messageDraft) {
        setGeneratedMessage(result.messageDraft.content);
        setDrafts((prev) => [
          {
            id: result.messageDraft.id,
            tone: result.messageDraft.tone,
            length: result.messageDraft.length,
            content: result.messageDraft.content,
            status: result.messageDraft.status,
            createdAt: result.messageDraft.createdAt,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/patients"
          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={20} />
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold text-gray-900">{patient.name}</h1>
            {patient.isVip && (
              <Star size={18} className="text-yellow-500 fill-yellow-500" />
            )}
          </div>
          <p className="text-sm text-gray-500">
            {patient.chartNumber} · {age}세 · {patient.gender === "M" ? "남" : "여"}
          </p>
        </div>
      </div>

      {/* Patient Info Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Phone size={14} /> 연락처
            </div>
            <p className="font-medium text-gray-900">{patient.phone}</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <Calendar size={14} /> 최근 방문
            </div>
            <p className="font-medium text-gray-900">
              {formatDate(visits[0]?.visitDate || null)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <FileText size={14} /> 방문 횟수
            </div>
            <p className="font-medium text-gray-900">{visits.length}회</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-gray-500 text-sm mb-1">
              <AlertTriangle size={14} /> 알림 수
            </div>
            <p className="font-medium text-gray-900">{detections.length}건</p>
          </CardContent>
        </Card>
      </div>

      {patient.memo && (
        <Card className="border-0 shadow-sm bg-yellow-50/50">
          <CardContent className="p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">메모:</span> {patient.memo}
            </p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="detections" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="detections" className="gap-1.5">
            <AlertTriangle size={14} />
            리콜 추천 ({detections.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="gap-1.5">
            <Calendar size={14} />
            방문 이력 ({visits.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-1.5">
            <MessageSquare size={14} />
            문자 초안 ({drafts.length})
          </TabsTrigger>
        </TabsList>

        {/* Detections Tab */}
        <TabsContent value="detections" className="space-y-3">
          {detections.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                현재 이 환자에 대한 추천 사항이 없습니다
              </CardContent>
            </Card>
          )}
          {detections.map((d, i) => (
            <Card key={i} className="border-0 shadow-sm">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={PRIORITY_COLORS[d.priority as Priority]}
                      >
                        {PRIORITY_LABELS[d.priority as Priority]}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={getRuleColor(d.ruleType)}
                      >
                        {SUB_TYPE_LABELS[d.subType as SubType] ||
                          RULE_TYPE_LABELS[d.ruleType as RuleType]}
                      </Badge>
                    </div>
                    <p className="text-sm text-gray-900 font-medium">{d.reason}</p>
                    <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Info size={12} /> 추천 근거
                      </div>
                      <p className="text-xs text-gray-600">{d.evidenceDetail}</p>
                      {d.dueDate && (
                        <p className="text-xs text-gray-500">
                          예정일: {formatDate(d.dueDate)}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => generateMessage(i)}
                    disabled={isGenerating}
                    className="shrink-0"
                  >
                    {isGenerating ? (
                      <Loader2 size={14} className="animate-spin mr-1" />
                    ) : (
                      <MessageSquare size={14} className="mr-1" />
                    )}
                    문자 생성
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {detections.length > 0 && (
            <Card className="border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-gray-700">
                  문자 생성 옵션
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">톤</label>
                  <div className="flex gap-2">
                    {(["polite", "friendly", "doctor"] as MessageTone[]).map((t) => (
                      <button
                        key={t}
                        onClick={() => setSelectedTone(t)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedTone === t
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {TONE_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 block mb-1.5">길이</label>
                  <div className="flex gap-2">
                    {(["short", "medium", "long"] as MessageLength[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setSelectedLength(l)}
                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                          selectedLength === l
                            ? "bg-blue-600 text-white"
                            : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                        }`}
                      >
                        {LENGTH_LABELS[l]}
                      </button>
                    ))}
                  </div>
                </div>
                {generatedMessage && (
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">
                      생성된 문자 초안
                    </label>
                    <Textarea
                      value={generatedMessage}
                      onChange={(e) => setGeneratedMessage(e.target.value)}
                      rows={5}
                      className="text-sm"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">
                      * 발송 전 반드시 내용을 확인해 주세요. 실제 발송 기능은 V2에서 제공됩니다.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Visits Tab */}
        <TabsContent value="visits" className="space-y-3">
          {visits.map((v) => (
            <Card key={v.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar size={14} className="text-gray-400" />
                  <span className="font-medium text-gray-900 text-sm">
                    {formatDate(v.visitDate)}
                  </span>
                  {v.memo && (
                    <span className="text-xs text-gray-400">· {v.memo}</span>
                  )}
                </div>

                {v.diagnoses.length > 0 && (
                  <div className="mb-2">
                    <p className="text-xs text-gray-500 mb-1">진단</p>
                    <div className="flex flex-wrap gap-1">
                      {v.diagnoses.map((d, i) => (
                        <Badge key={i} variant="outline" className="text-[11px]">
                          [{d.code}] {d.name}
                          {d.tooth && ` (${d.tooth}번)`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {v.procedures.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">처치</p>
                    <div className="flex flex-wrap gap-1">
                      {v.procedures.map((p, i) => (
                        <Badge
                          key={i}
                          variant="outline"
                          className="text-[11px] bg-blue-50 text-blue-700 border-blue-200"
                        >
                          [{p.code}] {p.name}
                          {p.tooth && ` (${p.tooth}번)`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
          {visits.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                방문 이력이 없습니다
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="space-y-3">
          {drafts.map((m) => (
            <Card key={m.id} className="border-0 shadow-sm">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-[11px]">
                    {TONE_LABELS[m.tone as MessageTone]}
                  </Badge>
                  <Badge variant="outline" className="text-[11px]">
                    {LENGTH_LABELS[m.length as MessageLength]}
                  </Badge>
                  <span className="text-xs text-gray-400">
                    {formatDate(m.createdAt)}
                  </span>
                </div>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.content}</p>
              </CardContent>
            </Card>
          ))}
          {drafts.length === 0 && (
            <Card className="border-0 shadow-sm">
              <CardContent className="p-8 text-center text-gray-400">
                생성된 문자 초안이 없습니다. 리콜 추천 탭에서 문자를 생성해 보세요.
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
