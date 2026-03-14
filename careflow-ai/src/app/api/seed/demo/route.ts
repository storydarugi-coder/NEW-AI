import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { normalizeSource, type NormalizationResult } from "@/lib/attribution/normalizer";
import { verifySession } from "@/lib/auth";
import { onDashboardDataChanged } from "@/lib/cache/dashboard-engine";

/**
 * 확장 데모 시드 (Extended Demo Seed)
 *
 * 기본 초기화(/api/seed) 이후 추가로 77명 환자 + 워크플로우 + 메시지 + 동기화 이력 등
 * 풍성한 데모 데이터를 생성합니다.
 *
 * 기본 초기화가 먼저 완료되어야 합니다 (캠페인, Staff, SourceRule 등이 필요).
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
      return NextResponse.json({ error: "DB 연결 불가", detail: dbCheck.error }, { status: 503 });
    }

    // 인증 필요 (기본 초기화 완료 후이므로 ADMIN 계정이 존재)
    const sessionToken = request.cookies.get("session")?.value;
    const user = verifySession(sessionToken);
    if (!user || user.role !== "ADMIN") {
      return NextResponse.json({ error: "ADMIN 권한이 필요합니다." }, { status: 403 });
    }

    // 기본 초기화 확인
    const [campaignCount, staffCount, sourceRuleCount] = await Promise.all([
      prisma.campaign.count(),
      prisma.staff.count(),
      prisma.sourceRule.count(),
    ]);
    if (campaignCount === 0 || staffCount === 0 || sourceRuleCount === 0) {
      return NextResponse.json({ error: "기본 초기화(/api/seed)를 먼저 실행해 주세요." }, { status: 400 });
    }

    const now = new Date();

    // 기존 캠페인/Staff/SourceRule ID 조회
    currentStep = "기존 데이터 조회";
    const allCampaigns = await prisma.campaign.findMany({ select: { id: true, name: true } });
    const campaignMap = new Map<string, string>();
    for (const c of allCampaigns) {
      if (c.name.includes("네이버")) campaignMap.set("naver_implant_mar", c.id);
      else if (c.name.includes("구글")) campaignMap.set("google_scaling_q1", c.id);
      else if (c.name.includes("카카오")) campaignMap.set("kakao_general_feb", c.id);
      else if (c.name.includes("인스타")) campaignMap.set("insta_ortho_mar", c.id);
    }

    const allStaff = await prisma.staff.findMany({ select: { id: true, role: true }, orderBy: { createdAt: "asc" } });
    const staffIds = allStaff.map(s => s.id);

    const allSourceRules = await prisma.sourceRule.findMany({ select: { id: true, ruleName: true } });
    const sourceRuleMap = new Map<string, string>();
    for (const r of allSourceRules) sourceRuleMap.set(r.ruleName, r.id);

    // 기존 환자 차트번호 조회 (중복 방지)
    const existingPatients = await prisma.patient.findMany({ select: { chartNumber: true, id: true } });
    const existingCharts = new Set(existingPatients.map(p => p.chartNumber));
    const chartToPatientId = new Map(existingPatients.map(p => [p.chartNumber, p.id]));

    // ── 추가 환자 77명 (CF-0011 ~ CF-0087) ──
    interface SeedVisit { visitDate: Date; memo?: string; sourceRaw?: string; channel?: string; isCta?: boolean; campaignKey?: string; hasTreatment?: boolean; procedures: { code: string; name: string; tooth?: string }[]; diagnoses: { code: string; name: string; tooth?: string }[] }
    interface SeedPatient { chartNumber: string; name: string; gender: string; birthYear: number; phone: string; tags?: string; isVip?: boolean; visits: SeedVisit[] }

    const demoPatients: SeedPatient[] = [
      { chartNumber: "CF-0011", name: "임재현", gender: "M", birthYear: 1970, phone: "010-1234-0011", tags: "매년스케일링", visits: [{ visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], channel: "phone" }] },
      { chartNumber: "CF-0012", name: "조은별", gender: "F", birthYear: 1993, phone: "010-1234-0012", visits: [{ visitDate: monthsAgo(13), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "카카오 플러스친구 쿠폰", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true }] },
      { chartNumber: "CF-0013", name: "남궁석", gender: "M", birthYear: 1965, phone: "010-1234-0013", tags: "만성치주염10년,정기관리필수", isVip: true, visits: [
        { visitDate: monthsAgo(16), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
        { visitDate: monthsAgo(10), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
        { visitDate: monthsAgo(5), procedures: [{ code: "U1020", name: "치근활택술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
      ] },
      { chartNumber: "CF-0014", name: "배소영", gender: "F", birthYear: 1972, phone: "010-1234-0014", visits: [{ visitDate: monthsAgo(15), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }] },
      { chartNumber: "CF-0015", name: "신동혁", gender: "M", birthYear: 1968, phone: "010-1234-0015", tags: "치주판막술경험,순응도높음", visits: [
        { visitDate: monthsAgo(8), procedures: [{ code: "U1030", name: "치주판막술" }], diagnoses: [{ code: "K054", name: "치주증" }] },
        { visitDate: monthsAgo(6), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
      ] },
      { chartNumber: "CF-0016", name: "장미경", gender: "F", birthYear: 1960, phone: "010-1234-0016", visits: [{ visitDate: monthsAgo(18), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }] },
      { chartNumber: "CF-0017", name: "고윤성", gender: "M", birthYear: 1983, phone: "010-1234-0017", visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "U1040", name: "치주치료" }, { code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [{ code: "K052", name: "급성치주염" }], sourceRaw: "구글 치과 검색", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }] },
      { chartNumber: "CF-0018", name: "문정훈", gender: "M", birthYear: 1963, phone: "010-1234-0018", isVip: true, tags: "임플란트2개,당뇨관리중", visits: [
        { visitDate: monthsAgo(8), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "36" }], sourceRaw: "네이버 임플란트 CPA 광고", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
        { visitDate: monthsAgo(5), procedures: [{ code: "U4451", name: "임플란트 2차 수술", tooth: "36" }], diagnoses: [] },
        { visitDate: monthsAgo(2), memo: "최종 보철 세팅", procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0019", name: "유하나", gender: "F", birthYear: 1958, phone: "010-1234-0019", tags: "골다공증약복용", visits: [
        { visitDate: monthsAgo(4), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "46" }], diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "46" }] },
        { visitDate: monthsAgo(3), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "46" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0020", name: "황인석", gender: "M", birthYear: 1955, phone: "010-1234-0020", visits: [
        { visitDate: monthsAgo(7), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "16" }], diagnoses: [], sourceRaw: "네이버 플레이스 광고 유입", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
        { visitDate: monthsAgo(6), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "16" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0021", name: "전소희", gender: "F", birthYear: 1973, phone: "010-1234-0021", visits: [
        { visitDate: monthsAgo(13), procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "26" }], diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "26" }] },
        { visitDate: monthsAgo(12), procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "26" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0022", name: "류태완", gender: "M", birthYear: 1950, phone: "010-1234-0022", isVip: true, tags: "75세고령,틀니→임플란트전환", visits: [
        { visitDate: monthsAgo(5), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "35" }], diagnoses: [] },
        { visitDate: monthsAgo(4), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "35" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0023", name: "권지영", gender: "F", birthYear: 1966, phone: "010-1234-0023", visits: [
        { visitDate: monthsAgo(14), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "47" }], diagnoses: [] },
        { visitDate: monthsAgo(13), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "47" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0024", name: "차민재", gender: "M", birthYear: 1975, phone: "010-1234-0024", visits: [
        { visitDate: monthsAgo(2), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "45" }], diagnoses: [], sourceRaw: "카카오 채널 임플란트 이벤트", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true },
        { visitDate: daysAgo(20), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "45" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0025", name: "안유진", gender: "F", birthYear: 1960, phone: "010-1234-0025", visits: [
        { visitDate: monthsAgo(10), procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "14" }], diagnoses: [] },
        { visitDate: monthsAgo(9), procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "14" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0026", name: "송지원", gender: "F", birthYear: 1998, phone: "010-1234-0026", visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }], channel: "referral" }] },
      { chartNumber: "CF-0027", name: "노현수", gender: "M", birthYear: 1996, phone: "010-1234-0027", visits: [{ visitDate: monthsAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }], channel: "online" }] },
      { chartNumber: "CF-0028", name: "하은채", gender: "F", birthYear: 2000, phone: "010-1234-0028", tags: "양쪽사랑니매복", visits: [{ visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }, { code: "K018", name: "매복치 기타", tooth: "28" }], sourceRaw: "인스타그램 교정 광고 → 사랑니 문의", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }] },
      { chartNumber: "CF-0029", name: "구본철", gender: "M", birthYear: 1994, phone: "010-1234-0029", visits: [{ visitDate: monthsAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }] }] },
      { chartNumber: "CF-0030", name: "피수연", gender: "F", birthYear: 1997, phone: "010-1234-0030", visits: [{ visitDate: monthsAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }], channel: "walk_in" }] },
      { chartNumber: "CF-0031", name: "양서준", gender: "M", birthYear: 2002, phone: "010-1234-0031", visits: [{ visitDate: monthsAgo(5), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K070", name: "악안면 이상" }], sourceRaw: "인스타그램 교정 비포애프터 광고", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }] },
      { chartNumber: "CF-0032", name: "도하영", gender: "F", birthYear: 2001, phone: "010-1234-0032", visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "ZZ002", name: "교정 검사" }], diagnoses: [{ code: "K071", name: "상하악 관계 이상" }], sourceRaw: "인스타 교정 DM 문의", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }] },
      { chartNumber: "CF-0033", name: "원세훈", gender: "M", birthYear: 2003, phone: "010-1234-0033", visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], channel: "referral" }] },
      { chartNumber: "CF-0034", name: "탁지민", gender: "F", birthYear: 1999, phone: "010-1234-0034", tags: "비용부담", visits: [
        { visitDate: monthsAgo(3), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K073", name: "치아 위치 이상" }] },
        { visitDate: monthsAgo(2), procedures: [{ code: "ZZ002", name: "교정 검사" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0035", name: "남수빈", gender: "F", birthYear: 2000, phone: "010-1234-0035", visits: [{ visitDate: monthsAgo(4), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] }] },
      { chartNumber: "CF-0036", name: "백은호", gender: "M", birthYear: 1986, phone: "010-1234-0036", visits: [{ visitDate: daysAgo(7), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "구글 스케일링 검색 유입", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }] },
      { chartNumber: "CF-0037", name: "공다은", gender: "F", birthYear: 1991, phone: "010-1234-0037", visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [], channel: "phone" }] },
      { chartNumber: "CF-0038", name: "석진우", gender: "M", birthYear: 1979, phone: "010-1234-0038", tags: "정상종료", visits: [{ visitDate: daysAgo(14), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "22" }, { code: "U4414", name: "근관충전(전치)", tooth: "22" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "22" }] }] },
      { chartNumber: "CF-0039", name: "주현아", gender: "F", birthYear: 1984, phone: "010-1234-0039", tags: "정상종료", visits: [
        { visitDate: daysAgo(10), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "46" }], diagnoses: [] },
        { visitDate: daysAgo(3), procedures: [{ code: "U6030", name: "크라운 세팅", tooth: "46" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0040", name: "방시혁", gender: "M", birthYear: 1972, phone: "010-1234-0040", isVip: true, visits: [
        { visitDate: daysAgo(5), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [], channel: "walk_in" },
        { visitDate: monthsAgo(3), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0041", name: "위지수", gender: "F", birthYear: 1995, phone: "010-1234-0041", visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "충전(레진)", tooth: "15" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "15" }], sourceRaw: "네이버 치과 예약", channel: "online" }] },
      { chartNumber: "CF-0042", name: "나현기", gender: "M", birthYear: 1967, phone: "010-1234-0042", visits: [
        { visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [] },
        { visitDate: monthsAgo(6), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0043", name: "민경호", gender: "M", birthYear: 1962, phone: "010-1234-0043", isVip: true, tags: "전체치료계획,고혈압,최우선관리", visits: [
        { visitDate: monthsAgo(18), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
        { visitDate: monthsAgo(6), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [], sourceRaw: "네이버 임플란트 CTA", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
        { visitDate: monthsAgo(5), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
        { visitDate: monthsAgo(4), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "47" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "47" }] },
      ] },
      { chartNumber: "CF-0044", name: "진소라", gender: "F", birthYear: 1985, phone: "010-1234-0044", tags: "비용부담", visits: [
        { visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
        { visitDate: monthsAgo(5), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
        { visitDate: monthsAgo(3), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] },
      ] },
      { chartNumber: "CF-0045", name: "채영수", gender: "M", birthYear: 1957, phone: "010-1234-0045", isVip: true, tags: "장기VIP,임플란트3개", visits: [
        { visitDate: monthsAgo(20), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
        { visitDate: monthsAgo(8), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "25" }], diagnoses: [] },
        { visitDate: monthsAgo(7), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "25" }], diagnoses: [] },
        { visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }], channel: "walk_in" },
      ] },
      { chartNumber: "CF-0046", name: "허성민", gender: "M", birthYear: 1989, phone: "010-1234-0046", visits: [{ visitDate: daysAgo(12), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 블로그 보고 옴", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }] },
      { chartNumber: "CF-0047", name: "추혜진", gender: "F", birthYear: 1991, phone: "010-1234-0047", visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "36" }], sourceRaw: "네이버에서 검색했는데 광고 아닌것 같아요 그냥 옴ㅎㅎ", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }] },
      { chartNumber: "CF-0048", name: "윤상호", gender: "M", birthYear: 1976, phone: "010-1234-0048", visits: [
        { visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "상담" }], diagnoses: [], sourceRaw: "구글에서 스케일링 검색하다 광고 클릭", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: false },
        { visitDate: daysAgo(15), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "구글 광고 다시 봄", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true },
      ] },
      { chartNumber: "CF-0049", name: "고나리", gender: "F", birthYear: 1994, phone: "010-1234-0049", visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "11" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "11" }], sourceRaw: "인스타 릴스에서 우리치과 교정광고봤는데 그냥 이아파서옴 ㅠㅠ", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: true }] },
      { chartNumber: "CF-0050", name: "방세영", gender: "F", birthYear: 1988, phone: "010-1234-0050", visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "카톡 플친 추가하고 쿠폰 받아서 예약함 스케일링", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true }] },
      { chartNumber: "CF-0051", name: "석준혁", gender: "M", birthYear: 1981, phone: "010-1234-0051", visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "46" }], sourceRaw: "네이벼 검색해서 옴 임플란트 가격 비교하려고 (오타 포함)", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }] },
      { chartNumber: "CF-0052", name: "오채린", gender: "F", birthYear: 1997, phone: "010-1234-0052", visits: [{ visitDate: monthsAgo(2), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "36" }], sourceRaw: "네이버 임플란트 광고 보고 예약", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true }] },
      { chartNumber: "CF-0053", name: "임도현", gender: "M", birthYear: 1969, phone: "010-1234-0053", visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "구글 스케일링 보험 검색 → 광고 클릭", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }] },
      { chartNumber: "CF-0054", name: "정예은", gender: "F", birthYear: 2001, phone: "010-1234-0054", visits: [{ visitDate: daysAgo(11), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K073", name: "치아 위치 이상" }], sourceRaw: "인스타 스토리 광고 교정비용 궁금해서", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }] },
      { chartNumber: "CF-0055", name: "백동우", gender: "M", birthYear: 1974, phone: "010-1234-0055", visits: [{ visitDate: daysAgo(16), procedures: [{ code: "U0001", name: "상담 및 X-ray" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "46" }], sourceRaw: "카카오 채널에서 임플란트 무료상담 이벤트 보고", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: false }] },
      { chartNumber: "CF-0056", name: "김수현", gender: "F", birthYear: 1999, phone: "010-1234-0056", visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타에서 봤어요" }] },
      { chartNumber: "CF-0057", name: "이준서", gender: "M", birthYear: 1993, phone: "010-1234-0057", visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "인스타그램 보고 예약했습니다" }] },
      { chartNumber: "CF-0058", name: "박지현", gender: "F", birthYear: 1996, phone: "010-1234-0058", visits: [{ visitDate: daysAgo(7), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], sourceRaw: "instagram 교정 후기 보고 왔어요" }] },
      { chartNumber: "CF-0059", name: "정우진", gender: "M", birthYear: 1987, phone: "010-1234-0059", visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }], sourceRaw: "네이버에서 검색해서 옴" }] },
      { chartNumber: "CF-0060", name: "최민지", gender: "F", birthYear: 1990, phone: "010-1234-0060", visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 블로그 후기 읽고 왔는데요" }] },
      { chartNumber: "CF-0061", name: "강예린", gender: "F", birthYear: 1985, phone: "010-1234-0061", visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "친구가 블로그 링크 보내줘서 옴" }] },
      { chartNumber: "CF-0062", name: "윤재혁", gender: "M", birthYear: 1979, phone: "010-1234-0062", visits: [{ visitDate: daysAgo(10), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "지인소개 추천받아서요" }] },
      { chartNumber: "CF-0063", name: "임하윤", gender: "F", birthYear: 2002, phone: "010-1234-0063", visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "그냥 왔어요" }] },
      { chartNumber: "CF-0064", name: "조성민", gender: "M", birthYear: 1971, phone: "010-1234-0064", visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지나가다 봄" }] },
      { chartNumber: "CF-0065", name: "한소윤", gender: "F", birthYear: 1983, phone: "010-1234-0065", visits: [{ visitDate: daysAgo(14), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }], sourceRaw: "아파서 급하게" }] },
      { chartNumber: "CF-0066", name: "서유진", gender: "F", birthYear: 1995, phone: "010-1234-0066", visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 광고 아니고 블로그에서 봤는데" }] },
      { chartNumber: "CF-0067", name: "오태준", gender: "M", birthYear: 1988, phone: "010-1234-0067", visits: [{ visitDate: daysAgo(13), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "간판보고 들어왔는데 인스타도 팔로우함" }] },
      { chartNumber: "CF-0068", name: "남시은", gender: "F", birthYear: 1992, phone: "010-1234-0068", visits: [{ visitDate: daysAgo(11), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "전화로 예약하고 옴" }] },
      { chartNumber: "CF-0069", name: "문준혁", gender: "M", birthYear: 1977, phone: "010-1234-0069", visits: [{ visitDate: daysAgo(15), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "동네 근처 치과 검색하다가" }] },
      { chartNumber: "CF-0070", name: "배소연", gender: "F", birthYear: 2001, phone: "010-1234-0070", visits: [{ visitDate: daysAgo(2), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], sourceRaw: "유튜브 교정 영상 광고에서 봤어요" }] },
      { chartNumber: "CF-0071", name: "정하린", gender: "F", birthYear: 1996, phone: "010-1234-0071", visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }] },
      { chartNumber: "CF-0072", name: "김태윤", gender: "M", birthYear: 1991, phone: "010-1234-0072", visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }] },
      { chartNumber: "CF-0073", name: "이서영", gender: "F", birthYear: 1988, phone: "010-1234-0073", visits: [{ visitDate: daysAgo(7), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }] },
      { chartNumber: "CF-0074", name: "박현서", gender: "M", birthYear: 1993, phone: "010-1234-0074", visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }] },
      { chartNumber: "CF-0075", name: "한소미", gender: "F", birthYear: 1995, phone: "010-1234-0075", visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }] },
      { chartNumber: "CF-0076", name: "조민혁", gender: "M", birthYear: 1987, phone: "010-1234-0076", visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }] },
      { chartNumber: "CF-0077", name: "윤서현", gender: "F", birthYear: 1990, phone: "010-1234-0077", visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }] },
      { chartNumber: "CF-0078", name: "강재윤", gender: "M", birthYear: 1984, phone: "010-1234-0078", visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }] },
      { chartNumber: "CF-0079", name: "임수아", gender: "F", birthYear: 1999, phone: "010-1234-0079", visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }] },
      { chartNumber: "CF-0080", name: "최우성", gender: "M", birthYear: 1977, phone: "010-1234-0080", visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }] },
      { chartNumber: "CF-0081", name: "남지아", gender: "F", birthYear: 1994, phone: "010-1234-0081", visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }] },
      { chartNumber: "CF-0082", name: "문재영", gender: "M", birthYear: 1982, phone: "010-1234-0082", visits: [{ visitDate: daysAgo(11), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }] },
      { chartNumber: "CF-0083", name: "배시연", gender: "F", birthYear: 2000, phone: "010-1234-0083", visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "기억 안나요" }] },
      { chartNumber: "CF-0084", name: "고현우", gender: "M", birthYear: 1986, phone: "010-1234-0084", visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "기억 안나요" }] },
      { chartNumber: "CF-0085", name: "장예진", gender: "F", birthYear: 1992, phone: "010-1234-0085", visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "잘 모르겠어요" }] },
      { chartNumber: "CF-0086", name: "서동규", gender: "M", birthYear: 1980, phone: "010-1234-0086", visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "소개받고 왔는데 광고도 봤어요" }] },
      { chartNumber: "CF-0087", name: "유채원", gender: "F", birthYear: 1997, phone: "010-1234-0087", visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "소개받고 왔는데 광고도 봤어요" }] },
    ];

    // 중복 필터링
    const newPatients = demoPatients.filter(p => !existingCharts.has(p.chartNumber));
    if (newPatients.length === 0) {
      return NextResponse.json({ success: true, phase: "demo", message: "데모 환자가 이미 모두 존재합니다. 추가 생성을 건너뜁니다." });
    }

    // 환자/방문/처치/진단/CTA 행 빌드
    currentStep = "데모 환자 데이터 빌드";
    const patientRows: { id: string; chartNumber: string; gender: string; birthYear: number; isVip: boolean; tags: string | null; updatedAt: Date }[] = [];
    const identityRows: { id: string; patientId: string; name: string; phone: string; updatedAt: Date }[] = [];
    const visitRows: Record<string, unknown>[] = [];
    const procedureRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const diagnosisRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const leadRows: Record<string, unknown>[] = [];

    for (const p of newPatients) {
      const patientId = randomUUID();
      chartToPatientId.set(p.chartNumber, patientId);
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

    // 벌크 INSERT (순차)
    currentStep = "Patient 생성";
    try { await prisma.patient.createMany({ data: patientRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "PatientIdentity 생성";
    try { await prisma.patientIdentity.createMany({ data: identityRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Visit 생성";
    try { await prisma.visit.createMany({ data: visitRows as any }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Procedure 생성";
    try { await prisma.procedure.createMany({ data: procedureRows }); } catch (err) { return seedError(currentStep, err); }
    currentStep = "Diagnosis 생성";
    try { await prisma.diagnosis.createMany({ data: diagnosisRows }); } catch (err) { return seedError(currentStep, err); }
    if (leadRows.length > 0) {
      currentStep = "LeadAttribution 생성";
      try { await prisma.leadAttribution.createMany({ data: leadRows as any }); } catch (err) { return seedError(currentStep, err); }
    }

    // ── 워크플로우 태스크 + 활동 로그 ──
    currentStep = "WorkflowTask 생성";
    interface TaskSeedItem { actionType: string; status: string; staffIndex: number; note: string | null; reason: string | null; nextFollowUpDays: number | null }
    const taskSeedMap: Record<string, TaskSeedItem[]> = {
      "CF-0001": [{ actionType: "CHURN_REENGAGE", status: "unprocessed", staffIndex: 0, note: null, reason: null, nextFollowUpDays: null }],
      "CF-0002": [{ actionType: "CHURN_REENGAGE", status: "reviewing", staffIndex: 1, note: "통증 사라져서 안 올 가능성 높음, 전화 시도 예정", reason: null, nextFollowUpDays: 0 }],
      "CF-0003": [{ actionType: "CHURN_REENGAGE", status: "waiting_contact", staffIndex: 0, note: "전화 연결 안 됨, 오후 재시도 예정", reason: null, nextFollowUpDays: 0 }],
      "CF-0005": [{ actionType: "CHURN_REENGAGE", status: "on_hold", staffIndex: 1, note: "보호자와 상의 후 다음 주 확인 요청", reason: "VIP 환자 — 원장 직접 연락 필요", nextFollowUpDays: 3 }],
      "CF-0006": [{ actionType: "CHURN_REENGAGE", status: "unprocessed", staffIndex: -1, note: null, reason: null, nextFollowUpDays: null }],
      "CF-0013": [
        { actionType: "PERIO_RECALL", status: "recheck_scheduled", staffIndex: 1, note: "치근활택 후 5개월 경과, 이번 주 내 연락 필요", reason: null, nextFollowUpDays: 1 },
        { actionType: "RECALL", status: "unprocessed", staffIndex: 0, note: null, reason: null, nextFollowUpDays: null },
      ],
      "CF-0018": [{ actionType: "IMPLANT_FOLLOWUP", status: "completed", staffIndex: 0, note: "카카오톡 발송 및 상담 완료", reason: "1개월 점검 안내 완료, 내원 약속 잡음", nextFollowUpDays: null }],
      "CF-0022": [{ actionType: "IMPLANT_FOLLOWUP", status: "waiting_contact", staffIndex: 0, note: "3개월 점검 시기, 고령 환자 보호자 연락처로 시도 필요", reason: null, nextFollowUpDays: -1 }],
      "CF-0028": [{ actionType: "MESSAGE_REVIEW", status: "excluded", staffIndex: 1, note: null, reason: "사랑니 발치 시기 미결정 — 본인이 연락하겠다고 함", nextFollowUpDays: null }],
      "CF-0043": [
        { actionType: "CHURN_REENGAGE", status: "reviewing", staffIndex: 2, note: "47번 신경치료 중단 4개월 경과, 원장 직접 연락 예정", reason: null, nextFollowUpDays: 2 },
        { actionType: "IMPLANT_FOLLOWUP", status: "unprocessed", staffIndex: -1, note: null, reason: null, nextFollowUpDays: null },
        { actionType: "RECALL", status: "unprocessed", staffIndex: 0, note: null, reason: null, nextFollowUpDays: null },
      ],
      "CF-0044": [{ actionType: "PERIO_RECALL", status: "waiting_contact", staffIndex: 1, note: "치주 안정 여부 확인 후 교정 재상담 권유 예정", reason: null, nextFollowUpDays: 5 }],
      "CF-0045": [{ actionType: "RECALL", status: "on_hold", staffIndex: 0, note: "장기 VIP 최근 미내원, 스케일링 시기 지남", reason: "진료 시작 여부 확인 필요", nextFollowUpDays: -2 }],
    };

    const taskRows: Record<string, unknown>[] = [];
    const activityRows: { id: string; taskId: string; patientId: string; staffId: string | null; action: string; fromValue: string | null; toValue: string | null }[] = [];

    for (const [chartNumber, taskItems] of Object.entries(taskSeedMap)) {
      const patientId = chartToPatientId.get(chartNumber);
      if (!patientId) continue;
      for (const ts of taskItems) {
        const taskId = randomUUID();
        const assigneeId = ts.staffIndex >= 0 && staffIds[ts.staffIndex] ? staffIds[ts.staffIndex] : null;
        const nextFollowUpAt = ts.nextFollowUpDays !== null
          ? (() => { const d = new Date(); d.setDate(d.getDate() + ts.nextFollowUpDays); d.setHours(9, 0, 0, 0); return d; })()
          : null;

        taskRows.push({
          id: taskId, patientId, actionType: ts.actionType, status: ts.status,
          assigneeId, note: ts.note, reason: ts.reason, nextFollowUpAt,
          completedAt: ts.status === "completed" ? daysAgo(3) : null, updatedAt: now,
        });

        activityRows.push({ id: randomUUID(), taskId, patientId, staffId: assigneeId, action: "task_created", fromValue: null, toValue: ts.actionType });
        if (ts.status !== "unprocessed") {
          activityRows.push({ id: randomUUID(), taskId, patientId, staffId: assigneeId, action: "status_change", fromValue: "unprocessed", toValue: ts.status });
        }
        if (ts.note) {
          activityRows.push({ id: randomUUID(), taskId, patientId, staffId: assigneeId, action: "note_added", fromValue: null, toValue: ts.note.substring(0, 100) });
        }
      }
    }

    if (taskRows.length > 0) {
      try { await prisma.workflowTask.createMany({ data: taskRows as any }); } catch (err) { return seedError(currentStep, err); }
    }
    currentStep = "ActivityLog 생성";
    if (activityRows.length > 0) {
      try { await prisma.activityLog.createMany({ data: activityRows }); } catch (err) { return seedError(currentStep, err); }
    }

    // ── SyncJob ──
    currentStep = "SyncJob 생성";
    try {
      await prisma.syncJob.createMany({ data: [
        { id: randomUUID(), syncType: "SEED", sourceSystem: "seed", status: "SUCCESS", startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000), finishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 5000), totalRecords: newPatients.length, successCount: newPatients.length, failedCount: 0, skippedCount: 0, duplicateCount: 0, unclassifiedCount: 0, triggeredBy: "관리자 홍길동", notes: "데모 시드 데이터 생성", updatedAt: now },
        { id: randomUUID(), syncType: "CSV_IMPORT", sourceSystem: "csv", status: "PARTIAL_SUCCESS", startedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), finishedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000 + 8000), totalRecords: 150, successCount: 142, failedCount: 3, skippedCount: 2, duplicateCount: 3, unclassifiedCount: 12, triggeredBy: "데스크 김소연", notes: "3월 방문경로 CSV 가져오기 — 일부 차트번호 매칭 실패", updatedAt: now },
        { id: randomUUID(), syncType: "CSV_IMPORT", sourceSystem: "csv", status: "SUCCESS", startedAt: new Date(now.getTime() - 30 * 60 * 1000), finishedAt: new Date(now.getTime() - 30 * 60 * 1000 + 3000), totalRecords: 50, successCount: 50, failedCount: 0, skippedCount: 0, duplicateCount: 0, unclassifiedCount: 2, triggeredBy: "데스크 김소연", notes: "추가 방문경로 보정 import", updatedAt: now },
        { id: randomUUID(), syncType: "EMR_PULL", sourceSystem: "mock-emr", status: "FAILED", startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000), finishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 1500), totalRecords: 0, successCount: 0, failedCount: 0, skippedCount: 0, duplicateCount: 0, unclassifiedCount: 0, triggeredBy: "system", notes: "EMR 연동 테스트 (mock)", errorSummary: "EMR API 연결 실패: ECONNREFUSED 127.0.0.1:8080", updatedAt: now },
      ] });
    } catch (err) { return seedError(currentStep, err); }

    // ── ImportBatch ──
    currentStep = "ImportBatch 생성";
    try {
      await prisma.importBatch.createMany({ data: [
        { id: randomUUID(), fileName: "202603_방문경로_일괄.csv", totalRows: 150, successCount: 142, failCount: 3, unclassifiedCount: 12, reviewNeededCount: 8, status: "completed", importedBy: "데스크 김소연", createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000), updatedAt: now },
        { id: randomUUID(), fileName: "202603_추가보정.csv", totalRows: 50, successCount: 50, failCount: 0, unclassifiedCount: 2, reviewNeededCount: 2, status: "completed", importedBy: "데스크 김소연", createdAt: new Date(now.getTime() - 30 * 60 * 1000), updatedAt: now },
        { id: randomUUID(), fileName: "202602_CTA_정리.csv", totalRows: 80, successCount: 75, failCount: 2, unclassifiedCount: 5, reviewNeededCount: 3, status: "completed", importedBy: "관리자 홍길동", createdAt: daysAgo(15), updatedAt: now },
      ] });
    } catch (err) { return seedError(currentStep, err); }

    // ── 후처리 ──
    currentStep = "후처리";
    try {
      await prisma.workflowTask.updateMany({ where: { status: "completed" }, data: { completedAt: daysAgo(1) } });
      const doNotContactCharts = ["CF-0008", "CF-0016"];
      for (const chart of doNotContactCharts) {
        const pid = chartToPatientId.get(chart);
        if (pid) {
          await prisma.patient.update({
            where: { id: pid },
            data: { doNotContact: true, doNotContactAt: daysAgo(10), doNotContactReason: "환자 본인 요청 — 문자 수신 거부" },
          });
        }
      }
    } catch (err) { return seedError(currentStep, err); }

    // ── 아웃바운드 메시지 ──
    currentStep = "OutboundMessage 생성";
    const outboundRows: Record<string, unknown>[] = [];
    const pid1 = chartToPatientId.get("CF-0001");
    if (pid1) outboundRows.push({ id: randomUUID(), patientId: pid1, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "김민수님, 안녕하세요. OO치과입니다. 치료 중이시던 46번 치아 근관충전이 아직 완료되지 않았습니다. 빠른 시일 내 내원 부탁드립니다.", finalMessage: null, approvalStatus: "REVIEW_NEEDED", approvedBy: null, approvedAt: null, sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null, sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now });
    const pid2 = chartToPatientId.get("CF-0005");
    if (pid2) outboundRows.push({ id: randomUUID(), patientId: pid2, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "정태영님, 안녕하세요. OO치과 원장입니다. VIP 고객님의 16번 치아 근관충전이 대기 중입니다.", finalMessage: null, approvalStatus: "REVIEW_NEEDED", approvedBy: null, approvedAt: null, sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null, sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "상담실장 박미영", sentBy: null, scheduledAt: null, updatedAt: now });
    const pid3 = chartToPatientId.get("CF-0006");
    if (pid3) outboundRows.push({ id: randomUUID(), patientId: pid3, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "한지은님, 크라운 제작이 완료되었습니다.", finalMessage: "한지은님, 안녕하세요. OO치과입니다. 크라운 제작이 완료되었습니다. 편하신 시간에 내원하여 세팅 받으시길 권합니다. (☎ 02-1234-5678)", approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(1), sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null, sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now });
    const pid4 = chartToPatientId.get("CF-0013");
    if (pid4) {
      const scheduledTime = new Date(); scheduledTime.setDate(scheduledTime.getDate() + 1); scheduledTime.setHours(10, 0, 0, 0);
      outboundRows.push({ id: randomUUID(), patientId: pid4, messageType: "SCALING_REMINDER", channel: "KAKAO", draftMessage: "남궁석님, 보험 스케일링 수진 시기가 지났습니다.", finalMessage: "남궁석님, 안녕하세요. OO치과입니다. 보험 스케일링 수진 시기가 도래하였습니다.", approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(2), sendStatus: "SCHEDULED", sentAt: null, failedAt: null, failureReason: null, sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: null, scheduledAt: scheduledTime, updatedAt: now });
    }
    const pid5 = chartToPatientId.get("CF-0018");
    if (pid5) outboundRows.push({ id: randomUUID(), patientId: pid5, messageType: "RECALL", channel: "KAKAO", draftMessage: "문정훈님, 임플란트 정기 점검 시기입니다.", finalMessage: "문정훈님, 안녕하세요. OO치과입니다. 임플란트(#36) 정기 점검 시기가 되었습니다.", approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(5), sendStatus: "SENT", sentAt: daysAgo(4), failedAt: null, failureReason: null, sendAttemptCount: 1, provider: "mock", duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now });
    const pid6 = chartToPatientId.get("CF-0022");
    if (pid6) outboundRows.push({ id: randomUUID(), patientId: pid6, messageType: "RECALL", channel: "KAKAO", draftMessage: "류태완님, 임플란트 3개월 점검 안내입니다.", finalMessage: "류태완님, 안녕하세요. OO치과입니다. 임플란트(#35) 3개월 정기 점검일이 지났습니다.", approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(7), sendStatus: "SENT", sentAt: daysAgo(6), failedAt: null, failureReason: null, sendAttemptCount: 1, provider: "mock", duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now });
    const pid7 = chartToPatientId.get("CF-0003");
    if (pid7) outboundRows.push({ id: randomUUID(), patientId: pid7, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "박준호님, 치료 중이시던 46번 치아 신경치료가 아직 완료되지 않았습니다.", finalMessage: "박준호님, 안녕하세요. OO치과입니다. 46번 치아 신경치료가 진행 중입니다.", approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(3), sendStatus: "FAILED", sentAt: null, failedAt: daysAgo(2), failureReason: "카카오 알림톡 발송 실패: 유효하지 않은 수신번호", sendAttemptCount: 2, provider: "mock", duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now });
    const pid8 = chartToPatientId.get("CF-0008");
    if (pid8) outboundRows.push({ id: randomUUID(), patientId: pid8, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "윤다혜님, 보철 치료가 대기 중입니다.", finalMessage: null, approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(4), sendStatus: "BLOCKED", sentAt: null, failedAt: null, failureReason: "수신 거부 환자", sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: true, createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now });
    const pid9 = chartToPatientId.get("CF-0018");
    if (pid9) outboundRows.push({ id: randomUUID(), patientId: pid9, messageType: "RECALL", channel: "KAKAO", draftMessage: "문정훈님, 임플란트 점검 시기 재안내입니다.", finalMessage: null, approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(2), sendStatus: "BLOCKED", sentAt: null, failedAt: null, failureReason: "7일 이내 동일 환자 동일 유형 발송 이력 있음", sendAttemptCount: 0, provider: null, duplicateBlocked: true, duplicateReason: "7일 이내 RECALL 유형 메시지 발송 이력 존재", doNotContactBlocked: false, createdBy: "상담실장 박미영", sentBy: null, scheduledAt: null, updatedAt: now });
    const pid10 = chartToPatientId.get("CF-0002");
    if (pid10) outboundRows.push({ id: randomUUID(), patientId: pid10, messageType: "TREATMENT_RESUME", channel: "KAKAO", draftMessage: "이영희님, 치료 중단된 36번 치아 신경치료를 완료해 주세요.", finalMessage: null, approvalStatus: "REJECTED", approvedBy: null, approvedAt: null, sendStatus: "CANCELLED", sentAt: null, failedAt: null, failureReason: null, sendAttemptCount: 0, provider: null, duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false, createdBy: "데스크 이지은", sentBy: null, scheduledAt: null, updatedAt: now });

    if (outboundRows.length > 0) {
      try { await prisma.outboundMessage.createMany({ data: outboundRows as any }); } catch (err) { return seedError(currentStep, err); }
    }

    // 감사 로그
    try {
      await prisma.auditLog.create({ data: { action: "seed_demo", entityType: "system", entityId: "seed", detail: JSON.stringify({ addedPatients: newPatients.length, phase: "demo" }) } });
    } catch { /* non-fatal */ }

    onDashboardDataChanged();

    return NextResponse.json({
      success: true,
      phase: "demo",
      message: `데모 데이터 추가 완료: ${newPatients.length}명의 환자, ${taskRows.length}개의 업무, ${outboundRows.length}개의 발송 메시지가 추가되었습니다.`,
    });
  } catch (error) {
    console.error("[Seed/Demo] 예상치 못한 오류:", error);
    return NextResponse.json(
      { error: `데모 데이터 생성 중 오류 (${currentStep}).`, step: currentStep, detail: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function seedError(step: string, err: unknown): NextResponse {
  console.error(`[Seed/Demo] ${step} 실패:`, err);
  const detail = err instanceof Error ? err.message : String(err);
  return NextResponse.json({ error: `${step} 중 오류`, step, detail }, { status: 500 });
}
