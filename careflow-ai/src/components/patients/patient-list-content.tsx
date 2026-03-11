"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Search,
  ChevronRight,
  Star,
  Filter,
} from "lucide-react";
import {
  SUB_TYPE_LABELS,
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  type SubType,
  type Priority,
} from "@/types";

interface Detection {
  ruleType: string;
  subType: string;
  priority: number;
  reason: string;
}

interface PatientItem {
  id: string;
  chartNumber: string;
  name: string;
  gender: string;
  birthYear: number;
  phone: string;
  isVip: boolean;
  lastVisitDate: string | null;
  visitCount: number;
  detections: Detection[];
  topPriority: number;
}

interface Props {
  patients: PatientItem[];
}

const segments = [
  { key: "all", label: "전체" },
  { key: "treatment_dropout", label: "치료 중단" },
  { key: "scaling_recall", label: "스케일링/치주" },
  { key: "implant_followup", label: "임플란트" },
  { key: "potential_demand", label: "잠재 수요" },
  { key: "vip", label: "VIP" },
  { key: "no_action", label: "액션 없음" },
];

function getRuleColor(ruleType: string): string {
  switch (ruleType) {
    case "treatment_dropout":
      return "bg-red-100 text-red-700 border-red-200";
    case "scaling_recall":
      return "bg-amber-100 text-amber-700 border-amber-200";
    case "implant_followup":
      return "bg-blue-100 text-blue-700 border-blue-200";
    case "potential_demand":
      return "bg-purple-100 text-purple-700 border-purple-200";
    default:
      return "bg-gray-100 text-gray-700 border-gray-200";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function PatientListContent({ patients }: Props) {
  const [search, setSearch] = useState("");
  const [segment, setSegment] = useState("all");
  const [sortBy, setSortBy] = useState<"priority" | "name" | "lastVisit">("priority");

  const filtered = useMemo(() => {
    let list = patients;

    // Search
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.chartNumber.toLowerCase().includes(q) ||
          p.phone.includes(q)
      );
    }

    // Segment
    if (segment === "vip") {
      list = list.filter((p) => p.isVip);
    } else if (segment === "no_action") {
      list = list.filter((p) => p.detections.length === 0);
    } else if (segment !== "all") {
      list = list.filter((p) =>
        p.detections.some((d) => d.ruleType === segment)
      );
    }

    // Sort
    if (sortBy === "priority") {
      list = [...list].sort((a, b) => a.topPriority - b.topPriority);
    } else if (sortBy === "name") {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name, "ko"));
    } else if (sortBy === "lastVisit") {
      list = [...list].sort((a, b) => {
        if (!a.lastVisitDate) return 1;
        if (!b.lastVisitDate) return -1;
        return new Date(b.lastVisitDate).getTime() - new Date(a.lastVisitDate).getTime();
      });
    }

    return list;
  }, [patients, search, segment, sortBy]);

  const currentYear = new Date().getFullYear();

  // 세그먼트별 카운트 계산
  const segmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: patients.length };
    counts.vip = patients.filter((p) => p.isVip).length;
    counts.no_action = patients.filter((p) => p.detections.length === 0).length;
    for (const s of ["treatment_dropout", "scaling_recall", "implant_followup", "potential_demand"]) {
      counts[s] = patients.filter((p) => p.detections.some((d) => d.ruleType === s)).length;
    }
    return counts;
  }, [patients]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">환자 관리</h1>
        <p className="text-sm text-gray-500 mt-1">
          전체 {patients.length}명 · 필터링 {filtered.length}명
        </p>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Segment tabs */}
        <div className="flex flex-wrap gap-2">
          {segments.map((s) => (
            <button
              key={s.key}
              onClick={() => setSegment(s.key)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                segment === s.key
                  ? "bg-blue-600 text-white"
                  : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
              }`}
            >
              {s.label}
              {segmentCounts[s.key] !== undefined && (
                <span className={`ml-1 text-xs ${segment === s.key ? "text-blue-200" : "text-gray-400"}`}>
                  {segmentCounts[s.key]}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search & Sort */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <Input
              placeholder="환자명, 차트번호, 전화번호 검색"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={14} className="text-gray-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white text-gray-700"
            >
              <option value="priority">우선순위순</option>
              <option value="name">이름순</option>
              <option value="lastVisit">최근 방문순</option>
            </select>
          </div>
        </div>
      </div>

      {/* Patient Table */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-50/50">
                  <TableHead className="w-[50px] text-center">우선순위</TableHead>
                  <TableHead>환자</TableHead>
                  <TableHead className="hidden md:table-cell">차트번호</TableHead>
                  <TableHead className="hidden lg:table-cell">연령/성별</TableHead>
                  <TableHead className="hidden md:table-cell">최근 방문</TableHead>
                  <TableHead>상태 태그</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((p) => (
                  <TableRow key={p.id} className="hover:bg-blue-50/30">
                    <TableCell className="text-center">
                      {p.topPriority < 99 ? (
                        <Badge
                          variant="outline"
                          className={PRIORITY_COLORS[p.topPriority as Priority]}
                        >
                          {PRIORITY_LABELS[p.topPriority as Priority]}
                        </Badge>
                      ) : (
                        <span className="text-xs text-gray-300">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-900">{p.name}</span>
                        {p.isVip && (
                          <Star size={14} className="text-yellow-500 fill-yellow-500" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">
                      {p.chartNumber}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-gray-500">
                      {currentYear - p.birthYear}세 / {p.gender === "M" ? "남" : "여"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-gray-500">
                      {formatDate(p.lastVisitDate)}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {p.detections.length === 0 && (
                          <span className="text-xs text-gray-300">-</span>
                        )}
                        {p.detections.slice(0, 3).map((d, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className={`text-[11px] ${getRuleColor(d.ruleType)}`}
                          >
                            {SUB_TYPE_LABELS[d.subType as SubType] || d.subType}
                          </Badge>
                        ))}
                        {p.detections.length > 3 && (
                          <Badge variant="outline" className="text-[11px]">
                            +{p.detections.length - 3}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/patients/${p.id}`}
                        className="text-blue-600 hover:text-blue-700"
                      >
                        <ChevronRight size={18} />
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-12 text-gray-400">
                      검색 결과가 없습니다
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
