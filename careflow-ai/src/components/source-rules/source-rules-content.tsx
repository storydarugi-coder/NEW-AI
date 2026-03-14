"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  BookOpen,
  Plus,
  ChevronDown,
  ChevronUp,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Trash2,
  Save,
  X,
  ArrowLeft,
  Search,
  Tag,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_LABELS } from "@/lib/attribution/rules";

interface SourceRule {
  id: string;
  ruleName: string;
  keywords: string;
  normalizedSource: string;
  sourceCategory: string;
  ctaCandidate: boolean;
  priority: number;
  isActive: boolean;
  description: string | null;
  isDefault?: boolean;
}

export function SourceRulesContent() {
  const [rules, setRules] = useState<SourceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDefault, setIsDefault] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/source-rules");
    const json = await res.json();
    setRules(json.rules || []);
    setIsDefault(json.isDefault || false);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  async function handleToggleActive(rule: SourceRule) {
    if (rule.isDefault) return;
    await fetch(`/api/source-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !rule.isActive }),
    });
    fetchRules();
  }

  async function handleDelete(id: string) {
    if (!confirm("이 규칙을 삭제하시겠습니까?")) return;
    await fetch(`/api/source-rules/${id}`, { method: "DELETE" });
    fetchRules();
  }

  const filtered = rules.filter((r) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.ruleName.toLowerCase().includes(s) ||
      r.normalizedSource.toLowerCase().includes(s) ||
      r.keywords.toLowerCase().includes(s) ||
      (r.description || "").toLowerCase().includes(s)
    );
  });

  // 카테고리별 집계
  const categoryStats = rules.reduce<Record<string, number>>((acc, r) => {
    acc[r.sourceCategory] = (acc[r.sourceCategory] || 0) + 1;
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="p-6 space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/internal/cpa" className="text-gray-400 hover:text-gray-600">
              <ArrowLeft size={16} />
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <BookOpen className="h-6 w-6 text-indigo-600" />
              유입 경로 규칙
            </h1>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            자유입력 방문 경로를 표준 분류로 변환하는 규칙을 관리합니다
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/source-review"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border bg-white hover:bg-gray-50"
          >
            <Search size={14} />
            유입 경로 검토
          </Link>
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Plus size={14} />
            규칙 추가
          </button>
        </div>
      </div>

      {isDefault && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
          DB에 저장된 규칙이 없어 기본 규칙을 표시 중입니다.
          시드 데이터를 실행하면 이 규칙들이 DB에 저장됩니다.
        </div>
      )}

      {/* 카테고리 요약 */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(categoryStats).map(([cat, count]) => (
          <span key={cat} className="px-2 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-700">
            {CATEGORY_LABELS[cat] || cat} {count}개
          </span>
        ))}
        <span className="px-2 py-1 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700">
          총 {rules.length}개 규칙
        </span>
      </div>

      {/* 검색 */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="규칙 이름, 키워드, 정규화 소스 검색..."
          className="w-full pl-9 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
        />
      </div>

      {/* 새 규칙 추가 폼 */}
      {showAdd && (
        <AddRuleForm
          onSave={() => { setShowAdd(false); fetchRules(); }}
          onCancel={() => setShowAdd(false)}
        />
      )}

      {/* 규칙 목록 */}
      <div className="space-y-2">
        {filtered.map((rule) => (
          <RuleCard
            key={rule.id}
            rule={rule}
            isEditing={editingId === rule.id}
            onToggleEdit={() => setEditingId(editingId === rule.id ? null : rule.id)}
            onToggleActive={() => handleToggleActive(rule)}
            onDelete={() => handleDelete(rule.id)}
            onSave={() => { setEditingId(null); fetchRules(); }}
          />
        ))}
      </div>
    </div>
  );
}

function RuleCard({
  rule,
  isEditing,
  onToggleEdit,
  onToggleActive,
  onDelete,
  onSave,
}: {
  rule: SourceRule;
  isEditing: boolean;
  onToggleEdit: () => void;
  onToggleActive: () => void;
  onDelete: () => void;
  onSave: () => void;
}) {
  const keywords = parseKeywords(rule.keywords);
  const isReadOnly = rule.isDefault;

  if (isEditing && !isReadOnly) {
    return <EditRuleForm rule={rule} onSave={onSave} onCancel={onToggleEdit} />;
  }

  return (
    <div className={cn(
      "bg-white border rounded-xl p-4 transition-colors",
      !rule.isActive && "opacity-50"
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-medium text-gray-900">{rule.ruleName}</span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
              우선순위 {rule.priority}
            </span>
            <span className={cn(
              "px-1.5 py-0.5 rounded text-[10px] font-medium",
              rule.ctaCandidate ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
            )}>
              {rule.ctaCandidate ? "CPA 후보" : "일반"}
            </span>
            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-100 text-indigo-700">
              {CATEGORY_LABELS[rule.sourceCategory] || rule.sourceCategory}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-700">→ {rule.normalizedSource}</span>
          </div>
          <div className="flex flex-wrap gap-1 mt-2">
            {keywords.map((kw, i) => (
              <span key={i} className="px-1.5 py-0.5 rounded text-[11px] bg-gray-50 text-gray-600 border">
                <Tag size={9} className="inline mr-0.5" />{kw}
              </span>
            ))}
          </div>
          {rule.description && (
            <div className="text-xs text-gray-400 mt-1">{rule.description}</div>
          )}
        </div>
        {!isReadOnly && (
          <div className="flex items-center gap-1.5 ml-3">
            <button onClick={onToggleActive} className="p-1.5 rounded hover:bg-gray-100" title={rule.isActive ? "비활성화" : "활성화"}>
              {rule.isActive ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} className="text-gray-400" />}
            </button>
            <button onClick={onToggleEdit} className="p-1.5 rounded hover:bg-gray-100" title="수정">
              <Pencil size={14} className="text-gray-500" />
            </button>
            <button onClick={onDelete} className="p-1.5 rounded hover:bg-red-50" title="삭제">
              <Trash2 size={14} className="text-red-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function AddRuleForm({ onSave, onCancel }: { onSave: () => void; onCancel: () => void }) {
  const [form, setForm] = useState({
    ruleName: "",
    keywords: "",
    normalizedSource: "",
    sourceCategory: "Unknown",
    ctaCandidate: false,
    priority: 50,
    description: "",
  });
  const [error, setError] = useState("");

  async function handleSubmit() {
    setError("");
    const keywordList = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    if (keywordList.length === 0) {
      setError("키워드를 1개 이상 입력하세요 (쉼표로 구분)");
      return;
    }

    const res = await fetch("/api/source-rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, keywords: keywordList }),
    });

    if (!res.ok) {
      const json = await res.json();
      setError(json.error || "저장 실패");
      return;
    }
    onSave();
  }

  return (
    <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
      <h3 className="font-medium text-indigo-900 flex items-center gap-2">
        <Plus size={16} /> 새 분류 규칙 추가
      </h3>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="규칙 이름 (영문)" value={form.ruleName} onChange={(v) => setForm({ ...form, ruleName: v })} placeholder="instagram_ads" />
        <FormField label="정규화 소스명" value={form.normalizedSource} onChange={(v) => setForm({ ...form, normalizedSource: v })} placeholder="Instagram Ads" />
        <FormField label="키워드 (쉼표 구분)" value={form.keywords} onChange={(v) => setForm({ ...form, keywords: v })} placeholder="인스타, 인스타그램, insta" className="col-span-2" />
        <div>
          <label className="block text-xs text-gray-600 mb-1">카테고리</label>
          <select
            value={form.sourceCategory}
            onChange={(e) => setForm({ ...form, sourceCategory: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <FormField label="우선순위 (낮을수록 먼저)" value={String(form.priority)} onChange={(v) => setForm({ ...form, priority: parseInt(v) || 50 })} placeholder="50" />
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" checked={form.ctaCandidate} onChange={(e) => setForm({ ...form, ctaCandidate: e.target.checked })} className="rounded" />
          <span className="text-sm text-gray-700">CPA 후보</span>
        </div>
        <FormField label="설명" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="규칙 설명..." className="col-span-2" />
      </div>
      {error && <div className="text-sm text-red-600">{error}</div>}
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700">
          <Save size={14} /> 저장
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-300">
          <X size={14} /> 취소
        </button>
      </div>
    </div>
  );
}

function EditRuleForm({ rule, onSave, onCancel }: { rule: SourceRule; onSave: () => void; onCancel: () => void }) {
  const keywords = parseKeywords(rule.keywords);
  const [form, setForm] = useState({
    keywords: keywords.join(", "),
    normalizedSource: rule.normalizedSource,
    sourceCategory: rule.sourceCategory,
    ctaCandidate: rule.ctaCandidate,
    priority: rule.priority,
    description: rule.description || "",
  });

  async function handleSubmit() {
    const keywordList = form.keywords.split(",").map((k) => k.trim()).filter(Boolean);
    await fetch(`/api/source-rules/${rule.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, keywords: keywordList }),
    });
    onSave();
  }

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
      <h3 className="font-medium text-amber-900">규칙 수정: {rule.ruleName}</h3>
      <div className="grid grid-cols-2 gap-3">
        <FormField label="정규화 소스명" value={form.normalizedSource} onChange={(v) => setForm({ ...form, normalizedSource: v })} />
        <FormField label="키워드 (쉼표 구분)" value={form.keywords} onChange={(v) => setForm({ ...form, keywords: v })} className="col-span-2" />
        <div>
          <label className="block text-xs text-gray-600 mb-1">카테고리</label>
          <select
            value={form.sourceCategory}
            onChange={(e) => setForm({ ...form, sourceCategory: e.target.value })}
            className="w-full px-3 py-1.5 border rounded-lg text-sm"
          >
            {Object.entries(CATEGORY_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </div>
        <FormField label="우선순위" value={String(form.priority)} onChange={(v) => setForm({ ...form, priority: parseInt(v) || 50 })} />
        <div className="flex items-center gap-2 mt-4">
          <input type="checkbox" checked={form.ctaCandidate} onChange={(e) => setForm({ ...form, ctaCandidate: e.target.checked })} className="rounded" />
          <span className="text-sm text-gray-700">CPA 후보</span>
        </div>
        <FormField label="설명" value={form.description} onChange={(v) => setForm({ ...form, description: v })} className="col-span-2" />
      </div>
      <div className="flex gap-2">
        <button onClick={handleSubmit} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 text-white text-xs font-medium rounded-lg hover:bg-amber-700">
          <Save size={14} /> 저장
        </button>
        <button onClick={onCancel} className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-200 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-300">
          <X size={14} /> 취소
        </button>
      </div>
    </div>
  );
}

function FormField({
  label, value, onChange, placeholder, className,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs text-gray-600 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-1.5 border rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
      />
    </div>
  );
}

function parseKeywords(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [raw];
  } catch {
    return [raw];
  }
}
