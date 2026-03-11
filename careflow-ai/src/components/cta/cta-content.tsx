"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Megaphone,
  Check,
  X,
  Star,
  TrendingUp,
  FileCheck,
  Clock,
  ChevronRight,
  BarChart3,
  Receipt,
} from "lucide-react";
import {
  CHANNEL_LABELS,
  REVIEW_STATUS_LABELS,
  REVIEW_STATUS_COLORS,
  CAMPAIGN_STATUS_LABELS,
  type VisitChannel,
  type AttributionReviewStatus,
  type CampaignStatus,
} from "@/types";
import { maskName } from "@/lib/privacy";

interface Lead {
  id: string;
  visitId: string;
  visitDate: string;
  patientId: string;
  patientName: string;
  chartNumber: string;
  isVip: boolean;
  channel: string | null;
  sourceRaw: string | null;
  campaignId: string;
  campaignName: string;
  platform: string;
  reviewStatus: string;
  autoReason: string | null;
  confidence: number | null;
  reviewer: string | null;
  reviewedAt: string | null;
  reviewMemo: string | null;
}

interface CampaignStat {
  id: string;
  name: string;
  platform: string;
  adType: string;
  status: string;
  startDate: string;
  endDate: string | null;
  budgetWon: number | null;
  costPerClick: number | null;
  totalLeads: number;
  confirmedLeads: number;
  pendingLeads: number;
  rejectedLeads: number;
}

interface Props {
  leads: Lead[];
  campaignStats: CampaignStat[];
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatWon(amount: number | null): string {
  if (amount == null) return "-";
  return `${(amount / 10000).toFixed(0)}만원`;
}

function getPlatformColor(platform: string): string {
  switch (platform) {
    case "naver": return "bg-green-100 text-green-700 border-green-200";
    case "google": return "bg-blue-100 text-blue-700 border-blue-200";
    case "kakao": return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "instagram": return "bg-pink-100 text-pink-700 border-pink-200";
    default: return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

export function CtaContent({ leads: initialLeads, campaignStats }: Props) {
  const [leads, setLeads] = useState(initialLeads);
  const [filter, setFilter] = useState<"all" | "pending" | "confirmed" | "rejected">("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [showMasked, setShowMasked] = useState(true);

  const filteredLeads = filter === "all" ? leads : leads.filter((l) => l.reviewStatus === filter);

  const summary = {
    total: leads.length,
    pending: leads.filter((l) => l.reviewStatus === "pending").length,
    confirmed: leads.filter((l) => l.reviewStatus === "confirmed").length,
    rejected: leads.filter((l) => l.reviewStatus === "rejected").length,
  };

  async function reviewLead(id: string, status: "confirmed" | "rejected") {
    setReviewingId(id);
    try {
      const res = await fetch("/api/cta/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ attributionId: id, reviewStatus: status }),
      });
      if (res.ok) {
        setLeads((prev) =>
          prev.map((l) =>
            l.id === id ? { ...l, reviewStatus: status, reviewer: "운영자", reviewedAt: new Date().toISOString() } : l
          )
        );
      }
    } catch {
      // silent
    } finally {
      setReviewingId(null);
    }
  }

  // 정산 요약 계산
  const settlementByCampaign = campaignStats.map((c) => ({
    ...c,
    settlementAmount: c.confirmedLeads * (c.costPerClick || 0),
  }));

  const totalSettlement = settlementByCampaign.reduce((sum, c) => sum + c.settlementAmount, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">CTA 광고 귀속 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          광고 유입 환자 검토 · 캠페인별 집계 · 정산 근거 관리
        </p>
      </div>

      {/* KPI 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "이번 달 CTA 유입", value: summary.total, icon: TrendingUp, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "검토 대기", value: summary.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "확정", value: summary.confirmed, icon: FileCheck, color: "text-green-600", bg: "bg-green-50" },
          { label: "진행 중 캠페인", value: campaignStats.filter((c) => c.status === "active").length, icon: Megaphone, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((card) => (
          <Card key={card.label} className="border-0 shadow-sm">
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div className={`p-3 rounded-xl ${card.bg}`}>
                  <card.icon size={22} className={card.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="leads" className="space-y-4">
        <TabsList className="bg-white border">
          <TabsTrigger value="leads" className="gap-1.5"><FileCheck size={14} />유입 환자 ({leads.length})</TabsTrigger>
          <TabsTrigger value="campaigns" className="gap-1.5"><BarChart3 size={14} />캠페인 집계</TabsTrigger>
          <TabsTrigger value="settlement" className="gap-1.5"><Receipt size={14} />정산 요약</TabsTrigger>
        </TabsList>

        {/* 유입 환자 목록 탭 */}
        <TabsContent value="leads" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {(["all", "pending", "confirmed", "rejected"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                  filter === f
                    ? "bg-blue-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
                }`}
              >
                {f === "all" ? "전체" : REVIEW_STATUS_LABELS[f as AttributionReviewStatus]}
                <span className={`ml-1 text-xs ${filter === f ? "text-blue-200" : "text-gray-400"}`}>
                  {f === "all" ? summary.total : summary[f as keyof typeof summary]}
                </span>
              </button>
            ))}
            <button
              onClick={() => setShowMasked(!showMasked)}
              className="ml-auto px-3 py-1.5 rounded-lg text-xs border border-gray-200 text-gray-500 hover:bg-gray-50"
            >
              {showMasked ? "이름 표시" : "이름 마스킹"}
            </button>
          </div>

          <Card className="border-0 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>환자</TableHead>
                      <TableHead>방문일</TableHead>
                      <TableHead>유입 채널</TableHead>
                      <TableHead>캠페인</TableHead>
                      <TableHead className="hidden lg:table-cell">자동 분류 근거</TableHead>
                      <TableHead className="text-center">상태</TableHead>
                      <TableHead className="w-[140px] text-center">액션</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLeads.map((lead) => (
                      <TableRow key={lead.id} className="hover:bg-blue-50/30">
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Link href={`/patients/${lead.patientId}`} className="font-medium text-gray-900 hover:text-blue-600">
                              {showMasked ? maskName(lead.patientName) : lead.patientName}
                            </Link>
                            {lead.isVip && <Star size={12} className="text-yellow-500 fill-yellow-500" />}
                          </div>
                          <span className="text-xs text-gray-400">{lead.chartNumber}</span>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600">
                          {formatDate(lead.visitDate)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] ${getPlatformColor(lead.platform)}`}>
                            {CHANNEL_LABELS[lead.channel as VisitChannel] || lead.channel || "-"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-gray-600 max-w-[160px] truncate">
                          {lead.campaignName}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell text-xs text-gray-500 max-w-[200px] truncate">
                          {lead.autoReason || "-"}
                          {lead.confidence != null && (
                            <span className="ml-1 text-gray-400">({Math.round(lead.confidence * 100)}%)</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="outline" className={`text-[11px] ${REVIEW_STATUS_COLORS[lead.reviewStatus as AttributionReviewStatus] || ""}`}>
                            {REVIEW_STATUS_LABELS[lead.reviewStatus as AttributionReviewStatus] || lead.reviewStatus}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {lead.reviewStatus === "pending" ? (
                            <div className="flex gap-1 justify-center">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-green-600 hover:bg-green-50"
                                disabled={reviewingId === lead.id}
                                onClick={() => reviewLead(lead.id, "confirmed")}
                              >
                                <Check size={12} className="mr-0.5" />확정
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2 text-xs text-gray-500 hover:bg-gray-50"
                                disabled={reviewingId === lead.id}
                                onClick={() => reviewLead(lead.id, "rejected")}
                              >
                                <X size={12} className="mr-0.5" />제외
                              </Button>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">
                              {lead.reviewer && `${lead.reviewer}`}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredLeads.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                          해당 조건의 유입 데이터가 없습니다
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 캠페인 집계 탭 */}
        <TabsContent value="campaigns" className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {campaignStats.map((c) => (
              <Card key={c.id} className="border-0 shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">{c.name}</CardTitle>
                    <div className="flex gap-1.5">
                      <Badge variant="outline" className={`text-[10px] ${getPlatformColor(c.platform)}`}>
                        {c.platform}
                      </Badge>
                      <Badge variant="outline" className={`text-[10px] ${c.status === "active" ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-500 border-gray-200"}`}>
                        {CAMPAIGN_STATUS_LABELS[c.status as CampaignStatus] || c.status}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 gap-3 text-center">
                    <div>
                      <p className="text-lg font-bold text-gray-900">{c.totalLeads}</p>
                      <p className="text-[10px] text-gray-500">총 유입</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-green-600">{c.confirmedLeads}</p>
                      <p className="text-[10px] text-gray-500">확정</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-amber-600">{c.pendingLeads}</p>
                      <p className="text-[10px] text-gray-500">검토 대기</p>
                    </div>
                    <div>
                      <p className="text-lg font-bold text-gray-400">{c.rejectedLeads}</p>
                      <p className="text-[10px] text-gray-500">제외</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t flex justify-between text-xs text-gray-500">
                    <span>{formatDate(c.startDate)} ~ {c.endDate ? formatDate(c.endDate) : "진행 중"}</span>
                    <span>예산 {formatWon(c.budgetWon)} · CPC {c.costPerClick ? `${c.costPerClick}원` : "-"}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* 정산 요약 탭 */}
        <TabsContent value="settlement" className="space-y-4">
          <Card className="border-0 shadow-sm bg-gradient-to-r from-green-50 to-emerald-50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">이번 달 정산 가능 총액 (확정 기준)</p>
                  <p className="text-3xl font-bold text-green-700 mt-1">
                    {totalSettlement > 0 ? `${(totalSettlement / 10000).toFixed(1)}만원` : "-"}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    확정 환자 {summary.confirmed}명 · 검토 대기 {summary.pending}명
                  </p>
                </div>
                <Receipt size={40} className="text-green-300" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">캠페인별 정산 내역</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gray-50/50">
                      <TableHead>캠페인</TableHead>
                      <TableHead>플랫폼</TableHead>
                      <TableHead className="text-center">총 유입</TableHead>
                      <TableHead className="text-center">확정</TableHead>
                      <TableHead className="text-center">CPC</TableHead>
                      <TableHead className="text-right">정산 금액</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {settlementByCampaign.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell className="font-medium text-sm">{c.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[11px] ${getPlatformColor(c.platform)}`}>
                            {c.platform}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center text-sm">{c.totalLeads}</TableCell>
                        <TableCell className="text-center text-sm font-medium text-green-600">{c.confirmedLeads}</TableCell>
                        <TableCell className="text-center text-sm text-gray-500">{c.costPerClick ? `${c.costPerClick}원` : "-"}</TableCell>
                        <TableCell className="text-right text-sm font-medium">
                          {c.settlementAmount > 0 ? `${(c.settlementAmount / 10000).toFixed(1)}만원` : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                    <TableRow className="bg-gray-50 font-medium">
                      <TableCell colSpan={3}>합계</TableCell>
                      <TableCell className="text-center text-green-600">{summary.confirmed}</TableCell>
                      <TableCell></TableCell>
                      <TableCell className="text-right text-green-700">
                        {totalSettlement > 0 ? `${(totalSettlement / 10000).toFixed(1)}만원` : "-"}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          <div className="bg-amber-50/50 border border-amber-100 rounded-lg px-4 py-3">
            <p className="text-xs text-amber-700">
              정산 금액은 확정된 CTA 유입 환자 수 × CPC 단가로 산정됩니다.
              검토 대기 건은 정산에 포함되지 않으며, 확정 후 반영됩니다.
              실제 정산은 광고 대행사와의 계약 조건에 따릅니다.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
