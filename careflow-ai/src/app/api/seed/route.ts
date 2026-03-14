import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { DEFAULT_SOURCE_RULES } from "@/lib/attribution/rules";
import { normalizeSource, type NormalizationResult } from "@/lib/attribution/normalizer";
import { hashPassword, verifySession } from "@/lib/auth";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";

/**
 * 최소 초기화 시드 (Fast Minimal Seed)
 *
 * 로그인 계정 + 10명 환자 + 기본 설정만 생성합니다.
 * Vercel Hobby 60초 타임아웃 안에 완료되도록 최소화.
 * 풍성한 데모 데이터는 /api/seed/demo 에서 추가합니다.
 */

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(10, 0, 0, 0);
  return d;
}

function monthsAgo(months: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setHours(10, 0, 0, 0);
  return d;
}

export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let currentStep = "초기화";
  try {
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다. DATABASE_URL 환경변수를 확인해 주세요.", detail: dbCheck.error },
        { status: 503 }
      );
    }

    // ── 보안: DB에 데이터가 이미 있으면 ADMIN 인증 필요 ──
    let isFirstSetup = false;
    try {
      const [patientCount, userCount] = await Promise.all([
        prisma.patient.count(),
        prisma.user.count(),
      ]);
      isFirstSetup = patientCount === 0 || userCount === 0;
    } catch {
      isFirstSetup = true;
    }

    if (!isFirstSetup) {
      const sessionToken = request.cookies.get("session")?.value;
      const user = verifySession(sessionToken);
      if (!user || user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "시드 실행은 ADMIN 권한이 필요합니다. 관리자로 로그인 후 다시 시도해주세요." },
          { status: 403 }
        );
      }
    }

    const now = new Date();

    // ── 1단계: 기존 데이터 삭제 (leaf → root) ──
    currentStep = "기존 데이터 삭제";
    try {
      await Promise.all([
        prisma.activityLog.deleteMany(),
        prisma.auditLog.deleteMany(),
        prisma.messageDelivery.deleteMany(),
        prisma.outboundMessage.deleteMany(),
        prisma.leadAttribution.deleteMany(),
        prisma.messageDraft.deleteMany(),
        prisma.recallRecommendation.deleteMany(),
        prisma.sourceNormalizationHistory.deleteMany(),
        prisma.importBatch.deleteMany(),
        prisma.syncJob.deleteMany(),
        prisma.user.deleteMany(),
      ]);
      await Promise.all([
        prisma.workflowTask.deleteMany(),
        prisma.staff.deleteMany(),
      ]);
      await Promise.all([
        prisma.diagnosis.deleteMany(),
        prisma.procedure.deleteMany(),
      ]);
      await prisma.visit.deleteMany();
      await Promise.all([
        prisma.patientIdentity.deleteMany(),
        prisma.campaign.deleteMany(),
        prisma.ruleConfig.deleteMany(),
        prisma.sourceRule.deleteMany(),
      ]);
      await prisma.patient.deleteMany();
    } catch (deleteErr) {
      console.error("[Seed] 기존 데이터 삭제 실패:", deleteErr);
      return NextResponse.json(
        { error: "기존 데이터 삭제 중 오류가 발생했습니다.", step: currentStep, detail: deleteErr instanceof Error ? deleteErr.message : String(deleteErr) },
        { status: 500 }
      );
    }

    // ── 2단계: 사용자 계정 먼저 생성 (가장 중요: 로그인 가능해야 함) ──
    currentStep = "User(사용자계정) 생성";
    const userDefs = [
      { username: "admin", password: "admin123", name: "관리자 홍길동", role: "ADMIN" },
      { username: "desk01", password: "desk123", name: "데스크 김소연", role: "DESK" },
      { username: "desk02", password: "desk123", name: "데스크 이지은", role: "DESK" },
      { username: "counsel01", password: "counsel123", name: "상담실장 박미영", role: "COUNSELOR" },
      { username: "viewer01", password: "view123", name: "원장 최진수", role: "VIEWER" },
      { username: "mkt01", password: "mkt123", name: "마케팅 정하늘", role: "MARKETING" },
    ];
    try {
      for (const u of userDefs) {
        await prisma.user.upsert({
          where: { username: u.username },
          update: { passwordHash: hashPassword(u.password), name: u.name, role: u.role, isActive: true, updatedAt: now },
          create: { id: randomUUID(), username: u.username, passwordHash: hashPassword(u.password), name: u.name, role: u.role, updatedAt: now },
        });
      }
    } catch (err) {
      return seedError(currentStep, err);
    }

    // ── 3단계: 기본 설정 데이터 ──

    // 캠페인 (4개)
    currentStep = "Campaign 생성";
    const campaignMap = new Map<string, string>();
    const campaigns = [
      { key: "naver_implant_mar", name: "2026년 3월 네이버 임플란트", platform: "naver", adType: "cta", startDate: monthsAgo(1), budgetWon: 3000000, costPerClick: 1500, status: "active" },
      { key: "google_scaling_q1", name: "2026년 Q1 구글 스케일링", platform: "google", adType: "cta", startDate: monthsAgo(3), budgetWon: 1500000, costPerClick: 800, status: "active" },
      { key: "kakao_general_feb", name: "2026년 2월 카카오 일반치료", platform: "kakao", adType: "cta", startDate: monthsAgo(2), endDate: monthsAgo(1), budgetWon: 2000000, costPerClick: 1200, status: "ended" },
      { key: "insta_ortho_mar", name: "2026년 3월 인스타 교정", platform: "instagram", adType: "cta", startDate: monthsAgo(1), budgetWon: 1000000, costPerClick: 2000, status: "active" },
    ];
    const campaignRows = campaigns.map((c) => {
      const id = randomUUID();
      campaignMap.set(c.key, id);
      return { id, name: c.name, platform: c.platform, adType: c.adType, startDate: c.startDate, endDate: c.endDate || null, budgetWon: c.budgetWon || null, costPerClick: c.costPerClick || null, status: c.status, updatedAt: now };
    });
    try {
      await prisma.campaign.createMany({ data: campaignRows });
    } catch (err) {
      return seedError(currentStep, err);
    }

    // 담당자 (4명)
    currentStep = "Staff 생성";
    const staffIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    try {
      await prisma.staff.createMany({ data: [
        { id: staffIds[0], name: "김수진", role: "desk", updatedAt: now },
        { id: staffIds[1], name: "박미영", role: "counselor", updatedAt: now },
        { id: staffIds[2], name: "이원장", role: "doctor", updatedAt: now },
        { id: staffIds[3], name: "정관리", role: "manager", updatedAt: now },
      ]});
    } catch (err) {
      return seedError(currentStep, err);
    }

    // 룰 설정 (4개)
    currentStep = "RuleConfig 생성";
    try {
      await prisma.ruleConfig.createMany({ data: [
        { id: randomUUID(), ruleType: "treatment_dropout", displayName: "치료 중단 탐지", description: "신경치료, 보철치료 중단 의심 환자를 탐지합니다.", enabled: true, parameters: JSON.stringify({ nerve_treatment_days: 14, prosthetic_days: 21 }), updatedAt: now },
        { id: randomUUID(), ruleType: "scaling_recall", displayName: "스케일링/치주 리콜", description: "보험 스케일링 미수진자와 치주 정기 리콜 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ scaling_months: 12, perio_recall_months: 4 }), updatedAt: now },
        { id: randomUUID(), ruleType: "implant_followup", displayName: "임플란트 사후관리", description: "임플란트 시술 후 정기 점검 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ implant_checkup_months: [1, 3, 6, 12] }), updatedAt: now },
        { id: randomUUID(), ruleType: "potential_demand", displayName: "잠재 수요 발굴", description: "사랑니 발치, 교정 등 상담 후 미전환 잠재 수요를 탐지합니다.", enabled: true, parameters: JSON.stringify({}), updatedAt: now },
      ]});
    } catch (err) {
      return seedError(currentStep, err);
    }

    // 방문경로 분류 사전 (16개)
    currentStep = "SourceRule 생성";
    const sourceRuleMap = new Map<string, string>();
    const sourceRuleRows = DEFAULT_SOURCE_RULES.map((r) => {
      const id = randomUUID();
      sourceRuleMap.set(r.ruleName, id);
      return { id, ruleName: r.ruleName, keywords: JSON.stringify(r.keywords), normalizedSource: r.normalizedSource, sourceCategory: r.sourceCategory, ctaCandidate: r.ctaCandidate, priority: r.priority, isActive: r.isActive, description: r.description, updatedAt: now };
    });
    try {
      await prisma.sourceRule.createMany({ data: sourceRuleRows });
    } catch (err) {
      return seedError(currentStep, err);
    }

    // 환자 10명 (CF-0001 ~ CF-0010)
    currentStep = "Patient 생성";
    interface SeedVisit { visitDate: Date; memo?: string; sourceRaw?: string; channel?: string; isCta?: boolean; campaignKey?: string; hasTreatment?: boolean; procedures: { code: string; name: string; tooth?: string }[]; diagnoses: { code: string; name: string; tooth?: string }[] }
    interface SeedPatient { chartNumber: string; name: string; gender: string; birthYear: number; phone: string; tags?: string; isVip?: boolean; visits: SeedVisit[] }

    const patients: SeedPatient[] = [
      {
        chartNumber: "CF-0001", name: "김민수", gender: "M", birthYear: 1985, phone: "010-1234-0001",
        tags: "야근잦음,예약취소이력",
        visits: [
          { visitDate: daysAgo(60), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "46" }], channel: "walk_in" },
          { visitDate: daysAgo(53), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }] },
          { visitDate: daysAgo(46), memo: "근관성형 진행", procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "46" }], diagnoses: [] },
        ],
      },
      {
        chartNumber: "CF-0002", name: "이영희", gender: "F", birthYear: 1990, phone: "010-1234-0002",
        tags: "중단이력",
        visits: [
          { visitDate: daysAgo(20), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "36" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "36" }] },
          { visitDate: daysAgo(13), procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "36" }], diagnoses: [] },
        ],
      },
      {
        chartNumber: "CF-0003", name: "박준호", gender: "M", birthYear: 1978, phone: "010-1234-0003",
        tags: "치과공포증",
        visits: [{ visitDate: daysAgo(40), procedures: [{ code: "U4413", name: "발수(복수근관)", tooth: "46" }], diagnoses: [{ code: "K041", name: "치수괴사", tooth: "46" }] }],
      },
      {
        chartNumber: "CF-0004", name: "최서연", gender: "F", birthYear: 1995, phone: "010-1234-0004",
        visits: [{ visitDate: daysAgo(18), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }], sourceRaw: "네이버 검색 광고 클릭", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true }],
      },
      {
        chartNumber: "CF-0005", name: "정태영", gender: "M", birthYear: 1982, phone: "010-1234-0005",
        isVip: true, tags: "가족4인,매출상위5%",
        visits: [
          { visitDate: monthsAgo(6), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], channel: "walk_in" },
          { visitDate: daysAgo(30), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "16" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "16" }] },
          { visitDate: daysAgo(23), procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "16" }], diagnoses: [] },
        ],
      },
      {
        chartNumber: "CF-0006", name: "한지은", gender: "F", birthYear: 1988, phone: "010-1234-0006",
        tags: "비용보류",
        visits: [
          { visitDate: daysAgo(45), procedures: [{ code: "U6020", name: "보철 prep", tooth: "26" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "26" }] },
          { visitDate: daysAgo(30), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "26" }], diagnoses: [] },
        ],
      },
      {
        chartNumber: "CF-0007", name: "오승민", gender: "M", birthYear: 1975, phone: "010-1234-0007",
        isVip: true, tags: "해외출장잦음",
        visits: [{ visitDate: daysAgo(35), procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "35" }], diagnoses: [] }],
      },
      {
        chartNumber: "CF-0008", name: "윤다혜", gender: "F", birthYear: 1992, phone: "010-1234-0008",
        visits: [{ visitDate: daysAgo(50), procedures: [{ code: "U6020", name: "보철 prep", tooth: "14" }], diagnoses: [{ code: "K030", name: "치아마모증", tooth: "14" }] }],
      },
      {
        chartNumber: "CF-0009", name: "강현우", gender: "M", birthYear: 1980, phone: "010-1234-0009",
        visits: [{ visitDate: daysAgo(25), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "47" }], diagnoses: [], sourceRaw: "구글 스케일링 검색 광고", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }],
      },
      {
        chartNumber: "CF-0010", name: "서미라", gender: "F", birthYear: 1987, phone: "010-1234-0010",
        visits: [{ visitDate: daysAgo(28), procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "15" }], diagnoses: [{ code: "K083", name: "잔존 치근", tooth: "15" }] }],
      },
    ];

    // 환자/방문/처치/진단/CTA 행 빌드
    const patientRows: { id: string; chartNumber: string; gender: string; birthYear: number; isVip: boolean; tags: string | null; updatedAt: Date }[] = [];
    const identityRows: { id: string; patientId: string; name: string; phone: string; updatedAt: Date }[] = [];
    const visitRows: Record<string, unknown>[] = [];
    const procedureRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const diagnosisRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const leadRows: Record<string, unknown>[] = [];

    for (const p of patients) {
      const patientId = randomUUID();
      patientRows.push({ id: patientId, chartNumber: p.chartNumber, gender: p.gender, birthYear: p.birthYear, isVip: p.isVip || false, tags: p.tags || null, updatedAt: now });
      identityRows.push({ id: randomUUID(), patientId, name: p.name, phone: p.phone, updatedAt: now });

      const campaignsSeen = new Set<string>();
      for (const v of p.visits) {
        const visitId = randomUUID();
        const campaignId = v.campaignKey ? campaignMap.get(v.campaignKey) || null : null;
        let norm: NormalizationResult | null = null;
        if (v.sourceRaw) norm = normalizeSource(v.sourceRaw);
        const matchedRuleId = norm?.matchedRuleName ? sourceRuleMap.get(norm.matchedRuleName) || null : null;
        const isHighConfidence = norm?.matchConfidence === "HIGH";

        visitRows.push({
          id: visitId, patientId, visitDate: v.visitDate, memo: v.memo || null,
          sourceRaw: v.sourceRaw || null, channel: v.channel || null, isCta: v.isCta || false, campaignId,
          normalizedSource: norm?.normalizedSource || null, sourceCategory: norm?.sourceCategory || null,
          ctaCandidate: norm?.ctaCandidate ?? null, matchConfidence: norm?.matchConfidence || null,
          matchReason: norm?.matchReason || null, matchedRuleId,
          reviewedSource: isHighConfidence ? norm?.normalizedSource || null : null,
          reviewedCategory: isHighConfidence ? norm?.sourceCategory || null : null,
          reviewedCtaFlag: isHighConfidence ? (norm?.ctaCandidate ?? null) : null,
          sourceReviewStatus: norm ? (isHighConfidence ? "auto_confirmed" : "unreviewed") : "unreviewed",
        });

        for (const proc of v.procedures) procedureRows.push({ id: randomUUID(), visitId, code: proc.code, name: proc.name, tooth: proc.tooth || null });
        for (const diag of v.diagnoses) diagnosisRows.push({ id: randomUUID(), visitId, code: diag.code, name: diag.name, tooth: diag.tooth || null });

        if (v.isCta && campaignId) {
          const isDuplicate = campaignsSeen.has(v.campaignKey || "");
          campaignsSeen.add(v.campaignKey || "");
          const treatmentStarted = v.hasTreatment ?? true;
          const rand = Math.random();
          const reviewStatus = rand > 0.35 ? "confirmed" : rand > 0.15 ? "pending" : "rejected";
          const settlementEligible = reviewStatus === "confirmed" && treatmentStarted && !isDuplicate;
          let ineligibleReason: string | null = null;
          if (!settlementEligible) {
            if (reviewStatus === "rejected") ineligibleReason = "CTA 유입이 아닌 것으로 판단 (반려)";
            else if (reviewStatus === "pending") ineligibleReason = "검토 대기 중";
            else if (!treatmentStarted) ineligibleReason = "실제 진료 미시작 (상담/검사만)";
            else if (isDuplicate) ineligibleReason = "동일 환자 중복 유입 (1회만 인정)";
          }
          const settlementMonth = `${v.visitDate.getFullYear()}-${String(v.visitDate.getMonth() + 1).padStart(2, "0")}`;
          const isReviewed = reviewStatus === "confirmed" || reviewStatus === "rejected";
          leadRows.push({
            id: randomUUID(), visitId, campaignId, reviewStatus,
            autoReason: `유입 경로에 광고 키워드 감지. 원문: "${v.sourceRaw}"`,
            confidence: 0.7 + Math.random() * 0.25,
            reviewer: isReviewed ? "데스크 김" : null,
            reviewedAt: isReviewed ? daysAgo(Math.floor(Math.random() * 7)) : null,
            treatmentStarted, isDuplicate, settlementMonth, settlementEligible, ineligibleReason, updatedAt: now,
          });
        }
      }
    }

    try { await prisma.patient.createMany({ data: patientRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "PatientIdentity 생성";
    try { await prisma.patientIdentity.createMany({ data: identityRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Visit 생성";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    try { await prisma.visit.createMany({ data: visitRows as any }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Procedure 생성";
    try { await prisma.procedure.createMany({ data: procedureRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Diagnosis 생성";
    try { await prisma.diagnosis.createMany({ data: diagnosisRows }); } catch (err) { return seedError(currentStep, err); }

    if (leadRows.length > 0) {
      currentStep = "LeadAttribution 생성";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      try { await prisma.leadAttribution.createMany({ data: leadRows as any }); } catch (err) { return seedError(currentStep, err); }
    }

    // 감사 로그
    try {
      await prisma.auditLog.create({
        data: { action: "seed_minimal", entityType: "system", entityId: "seed", detail: JSON.stringify({ patientCount: patients.length, phase: "minimal" }) },
      });
    } catch { /* non-fatal */ }

    onDashboardDataChanged();

    return NextResponse.json({
      success: true,
      phase: "minimal",
      message: `기본 초기화 완료: ${patients.length}명의 환자, 6명의 사용자 계정, 4개 캠페인이 생성되었습니다. admin / admin123 으로 로그인할 수 있습니다.`,
      loginInfo: { username: "admin", password: "admin123" },
      demoAvailable: true,
    });
  } catch (error) {
    console.error("[Seed] 예상치 못한 오류:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: `데이터 초기화 중 오류가 발생했습니다 (${currentStep}).`, step: currentStep, detail: errMsg },
      { status: 500 }
    );
  }
}

function seedError(step: string, err: unknown): NextResponse {
  console.error(`[Seed] ${step} 실패:`, err);
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: `${step} 중 오류`, step, detail }, { status: 500 });
}

export async function GET() {
  try {
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      return NextResponse.json({ status: "db_unavailable", patientCount: 0, error: dbCheck.error });
    }
    const count = await prisma.patient.count();
    return NextResponse.json({ status: "ok", patientCount: count });
  } catch {
    return NextResponse.json({ status: "error", patientCount: 0 });
  }
}
