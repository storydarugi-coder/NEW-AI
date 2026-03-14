import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  MessageSquare,
  Search,
  Shield,
  Sparkles,
  ArrowRight,
} from "lucide-react";

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Hero */}
      <div className="text-center space-y-3 pt-4">
        <Badge variant="outline" className="text-xs">
          운영 보조 도구 · 데모 버전
        </Badge>
        <h1 className="text-3xl font-bold text-gray-900">
          CareFlow AI
        </h1>
        <p className="text-lg text-gray-600">
          치과·병원을 위한 환자 리콜 관리 시스템
        </p>
        <p className="text-sm text-gray-500 max-w-xl mx-auto">
          환자 차트 데이터를 분석하여 치료 중단 의심 환자를 발굴하고,
          리콜 대상을 자동으로 추천하며, 개인화된 연락 문자 초안을 생성합니다.
        </p>
      </div>

      {/* 핵심 기능 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          {
            icon: Search,
            title: "치료 중단 자동 탐지",
            desc: "신경치료, 보철, 임플란트 등 중단된 치료를 규칙 기반으로 탐지합니다. 왜 탐지되었는지 근거와 함께 표시합니다.",
            color: "text-red-600 bg-red-50",
          },
          {
            icon: CalendarClock,
            title: "리콜 자동 추천",
            desc: "보험 스케일링 안내, 치주 정기 리콜, 임플란트 사후 점검 등 적시에 연락할 환자를 자동으로 추천합니다.",
            color: "text-amber-600 bg-amber-50",
          },
          {
            icon: MessageSquare,
            title: "AI 문자 초안 생성",
            desc: "환자 상황에 맞는 문자 메시지 초안을 3가지 버전(짧은/기본/따뜻한)으로 즉시 생성합니다.",
            color: "text-green-600 bg-green-50",
          },
          {
            icon: Sparkles,
            title: "설명 가능한 우선순위",
            desc: "각 환자의 우선순위 점수를 산정하고, 왜 이 점수인지 항목별 근거를 투명하게 보여줍니다.",
            color: "text-blue-600 bg-blue-50",
          },
        ].map((feature, i) => (
          <Card key={i} className="border-0 shadow-sm">
            <CardContent className="p-5 flex gap-4">
              <div className={`p-2.5 rounded-lg ${feature.color} h-fit shrink-0`}>
                <feature.icon size={20} />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 mb-1">{feature.title}</h3>
                <p className="text-sm text-gray-500">{feature.desc}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 대상 사용자 */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-6">
          <h2 className="font-bold text-gray-900 mb-3">누구를 위한 도구인가요?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="space-y-1">
              <p className="font-medium text-gray-800">🏥 치과 원장</p>
              <p>환자 이탈을 사전에 파악하고, 매출 기회를 놓치지 않도록 합니다.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-800">📋 데스크 직원</p>
              <p>리콜 대상을 자동으로 정리해 주어 수기 작업 부담을 줄입니다.</p>
            </div>
            <div className="space-y-1">
              <p className="font-medium text-gray-800">💬 상담실장</p>
              <p>상황에 맞는 문자 초안을 즉시 생성하여 업무 효율을 높입니다.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 데모 안내 */}
      <Card className="border-0 shadow-sm bg-blue-50/50">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <Shield className="text-blue-600 shrink-0 mt-0.5" size={20} />
            <div>
              <h2 className="font-bold text-gray-900 mb-2">데모 안내</h2>
              <ul className="text-sm text-gray-600 space-y-1.5">
                <li>• 현재 화면은 <strong>45명의 가상 환자 데이터</strong>로 구성된 데모입니다.</li>
                <li>• 실제 환자 정보는 포함되어 있지 않습니다.</li>
                <li>• AI 문자 초안은 <strong>운영 참고용</strong>이며, 의료 판단을 대신하지 않습니다.</li>
                <li>• 실제 운영 시에는 EMR/CRM 연동과 개인정보 보호 설정이 필요합니다.</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 주의사항 */}
      <Card className="border-0 shadow-sm border-l-4 border-l-amber-400">
        <CardContent className="p-5 flex items-start gap-3">
          <AlertTriangle className="text-amber-500 shrink-0 mt-0.5" size={18} />
          <div>
            <p className="text-sm font-medium text-gray-800">의료 면책 고지</p>
            <p className="text-xs text-gray-500 mt-1">
              CareFlow AI는 병원 운영 보조 도구입니다. 모든 추천은 참고용이며,
              최종 의료 판단과 환자 연락 여부는 반드시 의료진이 직접 결정해야 합니다.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* CTA */}
      <div className="text-center pb-4">
        <Link
          href="/hospital/dashboard"
          className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          대시보드에서 체험하기 <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  );
}
