import { NextRequest, NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";
import { randomUUID } from "crypto";
import { DEFAULT_SOURCE_RULES } from "@/lib/attribution/rules";
import { normalizeSource, type NormalizationResult } from "@/lib/attribution/normalizer";
import { hashPassword, verifySession } from "@/lib/auth";

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

interface SeedVisit {
  visitDate: Date;
  memo?: string;
  sourceRaw?: string;
  channel?: string;
  isCta?: boolean;
  campaignKey?: string;
  /** CTA: 이 방문에 실제 치료 처치가 포함되어 있는지 (상담/검사만이면 false) */
  hasTreatment?: boolean;
  procedures: { code: string; name: string; tooth?: string }[];
  diagnoses: { code: string; name: string; tooth?: string }[];
}

interface SeedPatient {
  chartNumber: string;
  name: string;
  gender: string;
  birthYear: number;
  phone: string;
  tags?: string;
  isVip?: boolean;
  visits: SeedVisit[];
}

interface SeedCampaign {
  key: string;
  name: string;
  platform: string;
  adType: string;
  startDate: Date;
  endDate?: Date;
  budgetWon?: number;
  costPerClick?: number;
  status: string;
}

const campaigns: SeedCampaign[] = [
  {
    key: "naver_implant_mar",
    name: "2026년 3월 네이버 임플란트",
    platform: "naver",
    adType: "cta",
    startDate: monthsAgo(1),
    budgetWon: 3000000,
    costPerClick: 1500,
    status: "active",
  },
  {
    key: "google_scaling_q1",
    name: "2026년 Q1 구글 스케일링",
    platform: "google",
    adType: "cta",
    startDate: monthsAgo(3),
    budgetWon: 1500000,
    costPerClick: 800,
    status: "active",
  },
  {
    key: "kakao_general_feb",
    name: "2026년 2월 카카오 일반치료",
    platform: "kakao",
    adType: "cta",
    startDate: monthsAgo(2),
    endDate: monthsAgo(1),
    budgetWon: 2000000,
    costPerClick: 1200,
    status: "ended",
  },
  {
    key: "insta_ortho_mar",
    name: "2026년 3월 인스타 교정",
    platform: "instagram",
    adType: "cta",
    startDate: monthsAgo(1),
    budgetWon: 1000000,
    costPerClick: 2000,
    status: "active",
  },
];

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
    visits: [
      { visitDate: daysAgo(40), procedures: [{ code: "U4413", name: "발수(복수근관)", tooth: "46" }], diagnoses: [{ code: "K041", name: "치수괴사", tooth: "46" }] },
    ],
  },
  {
    chartNumber: "CF-0004", name: "최서연", gender: "F", birthYear: 1995, phone: "010-1234-0004",
    visits: [
      { visitDate: daysAgo(18), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }], sourceRaw: "네이버 검색 광고 클릭", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
    ],
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
    visits: [
      { visitDate: daysAgo(35), procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "35" }], diagnoses: [] },
    ],
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
  {
    chartNumber: "CF-0011", name: "임재현", gender: "M", birthYear: 1970, phone: "010-1234-0011",
    tags: "매년스케일링",
    visits: [{ visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], channel: "phone" }],
  },
  {
    chartNumber: "CF-0012", name: "조은별", gender: "F", birthYear: 1993, phone: "010-1234-0012",
    visits: [{ visitDate: monthsAgo(13), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "카카오 플러스친구 쿠폰", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0013", name: "남궁석", gender: "M", birthYear: 1965, phone: "010-1234-0013",
    tags: "만성치주염10년,정기관리필수", isVip: true,
    visits: [
      { visitDate: monthsAgo(16), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
      { visitDate: monthsAgo(10), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
      { visitDate: monthsAgo(5), procedures: [{ code: "U1020", name: "치근활택술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
    ],
  },
  {
    chartNumber: "CF-0014", name: "배소영", gender: "F", birthYear: 1972, phone: "010-1234-0014",
    visits: [{ visitDate: monthsAgo(15), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0015", name: "신동혁", gender: "M", birthYear: 1968, phone: "010-1234-0015",
    tags: "치주판막술경험,순응도높음",
    visits: [
      { visitDate: monthsAgo(8), procedures: [{ code: "U1030", name: "치주판막술" }], diagnoses: [{ code: "K054", name: "치주증" }] },
      { visitDate: monthsAgo(6), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
    ],
  },
  {
    chartNumber: "CF-0016", name: "장미경", gender: "F", birthYear: 1960, phone: "010-1234-0016",
    visits: [{ visitDate: monthsAgo(18), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0017", name: "고윤성", gender: "M", birthYear: 1983, phone: "010-1234-0017",
    visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "U1040", name: "치주치료" }, { code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [{ code: "K052", name: "급성치주염" }], sourceRaw: "구글 치과 검색", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0018", name: "문정훈", gender: "M", birthYear: 1963, phone: "010-1234-0018",
    isVip: true, tags: "임플란트2개,당뇨관리중",
    visits: [
      { visitDate: monthsAgo(8), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "36" }], sourceRaw: "네이버 임플란트 CTA 광고", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
      { visitDate: monthsAgo(5), procedures: [{ code: "U4451", name: "임플란트 2차 수술", tooth: "36" }], diagnoses: [] },
      { visitDate: monthsAgo(2), memo: "최종 보철 세팅", procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0019", name: "유하나", gender: "F", birthYear: 1958, phone: "010-1234-0019",
    tags: "골다공증약복용",
    visits: [
      { visitDate: monthsAgo(4), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "46" }], diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "46" }] },
      { visitDate: monthsAgo(3), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "46" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0020", name: "황인석", gender: "M", birthYear: 1955, phone: "010-1234-0020",
    visits: [
      { visitDate: monthsAgo(7), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "16" }], diagnoses: [], sourceRaw: "네이버 플레이스 광고 유입", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
      { visitDate: monthsAgo(6), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "16" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0021", name: "전소희", gender: "F", birthYear: 1973, phone: "010-1234-0021",
    visits: [
      { visitDate: monthsAgo(13), procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "26" }], diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "26" }] },
      { visitDate: monthsAgo(12), procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "26" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0022", name: "류태완", gender: "M", birthYear: 1950, phone: "010-1234-0022",
    isVip: true, tags: "75세고령,틀니→임플란트전환",
    visits: [
      { visitDate: monthsAgo(5), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "35" }], diagnoses: [] },
      { visitDate: monthsAgo(4), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "35" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0023", name: "권지영", gender: "F", birthYear: 1966, phone: "010-1234-0023",
    visits: [
      { visitDate: monthsAgo(14), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "47" }], diagnoses: [] },
      { visitDate: monthsAgo(13), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "47" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0024", name: "차민재", gender: "M", birthYear: 1975, phone: "010-1234-0024",
    visits: [
      { visitDate: monthsAgo(2), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "45" }], diagnoses: [], sourceRaw: "카카오 채널 임플란트 이벤트", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true },
      { visitDate: daysAgo(20), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "45" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0025", name: "안유진", gender: "F", birthYear: 1960, phone: "010-1234-0025",
    visits: [
      { visitDate: monthsAgo(10), procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "14" }], diagnoses: [] },
      { visitDate: monthsAgo(9), procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "14" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0026", name: "송지원", gender: "F", birthYear: 1998, phone: "010-1234-0026",
    visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }], channel: "referral" }],
  },
  {
    chartNumber: "CF-0027", name: "노현수", gender: "M", birthYear: 1996, phone: "010-1234-0027",
    visits: [{ visitDate: monthsAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }], channel: "online" }],
  },
  {
    chartNumber: "CF-0028", name: "하은채", gender: "F", birthYear: 2000, phone: "010-1234-0028",
    tags: "양쪽사랑니매복",
    visits: [{ visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }, { code: "K018", name: "매복치 기타", tooth: "28" }], sourceRaw: "인스타그램 교정 광고 → 사랑니 문의", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }],
  },
  {
    chartNumber: "CF-0029", name: "구본철", gender: "M", birthYear: 1994, phone: "010-1234-0029",
    visits: [{ visitDate: monthsAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }] }],
  },
  {
    chartNumber: "CF-0030", name: "피수연", gender: "F", birthYear: 1997, phone: "010-1234-0030",
    visits: [{ visitDate: monthsAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }], channel: "walk_in" }],
  },
  {
    chartNumber: "CF-0031", name: "양서준", gender: "M", birthYear: 2002, phone: "010-1234-0031",
    visits: [{ visitDate: monthsAgo(5), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K070", name: "악안면 이상" }], sourceRaw: "인스타그램 교정 비포애프터 광고", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }],
  },
  {
    chartNumber: "CF-0032", name: "도하영", gender: "F", birthYear: 2001, phone: "010-1234-0032",
    visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "ZZ002", name: "교정 검사" }], diagnoses: [{ code: "K071", name: "상하악 관계 이상" }], sourceRaw: "인스타 교정 DM 문의", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }],
  },
  {
    chartNumber: "CF-0033", name: "원세훈", gender: "M", birthYear: 2003, phone: "010-1234-0033",
    visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], channel: "referral" }],
  },
  {
    chartNumber: "CF-0034", name: "탁지민", gender: "F", birthYear: 1999, phone: "010-1234-0034",
    tags: "비용부담",
    visits: [
      { visitDate: monthsAgo(3), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K073", name: "치아 위치 이상" }] },
      { visitDate: monthsAgo(2), procedures: [{ code: "ZZ002", name: "교정 검사" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0035", name: "남수빈", gender: "F", birthYear: 2000, phone: "010-1234-0035",
    visits: [{ visitDate: monthsAgo(4), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0036", name: "백은호", gender: "M", birthYear: 1986, phone: "010-1234-0036",
    visits: [{ visitDate: daysAgo(7), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "구글 스케일링 검색 유입", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0037", name: "공다은", gender: "F", birthYear: 1991, phone: "010-1234-0037",
    visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [], channel: "phone" }],
  },
  {
    chartNumber: "CF-0038", name: "석진우", gender: "M", birthYear: 1979, phone: "010-1234-0038",
    tags: "정상종료",
    visits: [{ visitDate: daysAgo(14), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "22" }, { code: "U4414", name: "근관충전(전치)", tooth: "22" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "22" }] }],
  },
  {
    chartNumber: "CF-0039", name: "주현아", gender: "F", birthYear: 1984, phone: "010-1234-0039",
    tags: "정상종료",
    visits: [
      { visitDate: daysAgo(10), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "46" }], diagnoses: [] },
      { visitDate: daysAgo(3), procedures: [{ code: "U6030", name: "크라운 세팅", tooth: "46" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0040", name: "방시혁", gender: "M", birthYear: 1972, phone: "010-1234-0040",
    isVip: true,
    visits: [
      { visitDate: daysAgo(5), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [], channel: "walk_in" },
      { visitDate: monthsAgo(3), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0041", name: "위지수", gender: "F", birthYear: 1995, phone: "010-1234-0041",
    visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "충전(레진)", tooth: "15" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "15" }], sourceRaw: "네이버 치과 예약", channel: "online" }],
  },
  {
    chartNumber: "CF-0042", name: "나현기", gender: "M", birthYear: 1967, phone: "010-1234-0042",
    visits: [
      { visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [] },
      { visitDate: monthsAgo(6), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0043", name: "민경호", gender: "M", birthYear: 1962, phone: "010-1234-0043",
    isVip: true, tags: "전체치료계획,고혈압,최우선관리",
    visits: [
      { visitDate: monthsAgo(18), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
      { visitDate: monthsAgo(6), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [], sourceRaw: "네이버 임플란트 CTA", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true },
      { visitDate: monthsAgo(5), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
      { visitDate: monthsAgo(4), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "47" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "47" }] },
    ],
  },
  {
    chartNumber: "CF-0044", name: "진소라", gender: "F", birthYear: 1985, phone: "010-1234-0044",
    tags: "비용부담",
    visits: [
      { visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
      { visitDate: monthsAgo(5), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
      { visitDate: monthsAgo(3), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0045", name: "채영수", gender: "M", birthYear: 1957, phone: "010-1234-0045",
    isVip: true, tags: "장기VIP,임플란트3개",
    visits: [
      { visitDate: monthsAgo(20), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
      { visitDate: monthsAgo(8), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "25" }], diagnoses: [] },
      { visitDate: monthsAgo(7), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "25" }], diagnoses: [] },
      { visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }], channel: "walk_in" },
    ],
  },
  // ── 다양한 CTA 시나리오 추가 ──
  // 반려(rejected) CTA 케이스
  {
    chartNumber: "CF-0046", name: "허성민", gender: "M", birthYear: 1989, phone: "010-1234-0046",
    visits: [{ visitDate: daysAgo(12), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 블로그 보고 옴", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }],
  },
  {
    chartNumber: "CF-0047", name: "추혜진", gender: "F", birthYear: 1991, phone: "010-1234-0047",
    visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "36" }], sourceRaw: "네이버에서 검색했는데 광고 아닌것 같아요 그냥 옴ㅎㅎ", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }],
  },
  // 중복 유입 환자 (같은 캠페인에서 2회)
  {
    chartNumber: "CF-0048", name: "윤상호", gender: "M", birthYear: 1976, phone: "010-1234-0048",
    visits: [
      { visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "상담" }], diagnoses: [], sourceRaw: "구글에서 스케일링 검색하다 광고 클릭", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: false },
      { visitDate: daysAgo(15), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "구글 광고 다시 봄", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true },
    ],
  },
  // 지저분한 원문 텍스트 (소스 정규화 테스트용)
  {
    chartNumber: "CF-0049", name: "고나리", gender: "F", birthYear: 1994, phone: "010-1234-0049",
    visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "11" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "11" }], sourceRaw: "인스타 릴스에서 우리치과 교정광고봤는데 그냥 이아파서옴 ㅠㅠ", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0050", name: "방세영", gender: "F", birthYear: 1988, phone: "010-1234-0050",
    visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "카톡 플친 추가하고 쿠폰 받아서 예약함 스케일링", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0051", name: "석준혁", gender: "M", birthYear: 1981, phone: "010-1234-0051",
    visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "46" }], sourceRaw: "네이벼 검색해서 옴 임플란트 가격 비교하려고 (오타 포함)", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: false }],
  },
  // 다른 월 정산 데이터 (2달 전 / 3달 전)
  {
    chartNumber: "CF-0052", name: "오채린", gender: "F", birthYear: 1997, phone: "010-1234-0052",
    visits: [{ visitDate: monthsAgo(2), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "36" }], sourceRaw: "네이버 임플란트 광고 보고 예약", channel: "cta_naver", isCta: true, campaignKey: "naver_implant_mar", hasTreatment: true }],
  },
  {
    chartNumber: "CF-0053", name: "임도현", gender: "M", birthYear: 1969, phone: "010-1234-0053",
    visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "구글 스케일링 보험 검색 → 광고 클릭", channel: "cta_google", isCta: true, campaignKey: "google_scaling_q1", hasTreatment: true }],
  },
  // 상담만 하고 진료 안 시작 (정산 미인정)
  {
    chartNumber: "CF-0054", name: "정예은", gender: "F", birthYear: 2001, phone: "010-1234-0054",
    visits: [{ visitDate: daysAgo(11), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K073", name: "치아 위치 이상" }], sourceRaw: "인스타 스토리 광고 교정비용 궁금해서", channel: "cta_instagram", isCta: true, campaignKey: "insta_ortho_mar", hasTreatment: false }],
  },
  {
    chartNumber: "CF-0055", name: "백동우", gender: "M", birthYear: 1974, phone: "010-1234-0055",
    visits: [{ visitDate: daysAgo(16), procedures: [{ code: "U0001", name: "상담 및 X-ray" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "46" }], sourceRaw: "카카오 채널에서 임플란트 무료상담 이벤트 보고", channel: "cta_kakao", isCta: true, campaignKey: "kakao_general_feb", hasTreatment: false }],
  },
  // ── 다양한 자유입력 방문경로 시나리오 ──
  // 인스타 다양한 표현
  {
    chartNumber: "CF-0056", name: "김수현", gender: "F", birthYear: 1999, phone: "010-1234-0056",
    visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타에서 봤어요" }],
  },
  {
    chartNumber: "CF-0057", name: "이준서", gender: "M", birthYear: 1993, phone: "010-1234-0057",
    visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "인스타그램 보고 예약했습니다" }],
  },
  {
    chartNumber: "CF-0058", name: "박지현", gender: "F", birthYear: 1996, phone: "010-1234-0058",
    visits: [{ visitDate: daysAgo(7), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], sourceRaw: "instagram 교정 후기 보고 왔어요" }],
  },
  // 네이버 다양한 표현
  {
    chartNumber: "CF-0059", name: "정우진", gender: "M", birthYear: 1987, phone: "010-1234-0059",
    visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }], sourceRaw: "네이버에서 검색해서 옴" }],
  },
  {
    chartNumber: "CF-0060", name: "최민지", gender: "F", birthYear: 1990, phone: "010-1234-0060",
    visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 블로그 후기 읽고 왔는데요" }],
  },
  // 블로그/검색/지인 혼합
  {
    chartNumber: "CF-0061", name: "강예린", gender: "F", birthYear: 1985, phone: "010-1234-0061",
    visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "친구가 블로그 링크 보내줘서 옴" }],
  },
  {
    chartNumber: "CF-0062", name: "윤재혁", gender: "M", birthYear: 1979, phone: "010-1234-0062",
    visits: [{ visitDate: daysAgo(10), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "지인소개 추천받아서요" }],
  },
  // 애매한 원문 (Unknown으로 가야 함)
  {
    chartNumber: "CF-0063", name: "임하윤", gender: "F", birthYear: 2002, phone: "010-1234-0063",
    visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "그냥 왔어요" }],
  },
  {
    chartNumber: "CF-0064", name: "조성민", gender: "M", birthYear: 1971, phone: "010-1234-0064",
    visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지나가다 봄" }],
  },
  {
    chartNumber: "CF-0065", name: "한소윤", gender: "F", birthYear: 1983, phone: "010-1234-0065",
    visits: [{ visitDate: daysAgo(14), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }], sourceRaw: "아파서 급하게" }],
  },
  // 오분류 가능성 사례
  {
    chartNumber: "CF-0066", name: "서유진", gender: "F", birthYear: 1995, phone: "010-1234-0066",
    visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버 광고 아니고 블로그에서 봤는데" }],
  },
  {
    chartNumber: "CF-0067", name: "오태준", gender: "M", birthYear: 1988, phone: "010-1234-0067",
    visits: [{ visitDate: daysAgo(13), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [], sourceRaw: "간판보고 들어왔는데 인스타도 팔로우함" }],
  },
  // 전화/온라인 예약 등
  {
    chartNumber: "CF-0068", name: "남시은", gender: "F", birthYear: 1992, phone: "010-1234-0068",
    visits: [{ visitDate: daysAgo(11), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "전화로 예약하고 옴" }],
  },
  {
    chartNumber: "CF-0069", name: "문준혁", gender: "M", birthYear: 1977, phone: "010-1234-0069",
    visits: [{ visitDate: daysAgo(15), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "동네 근처 치과 검색하다가" }],
  },
  {
    chartNumber: "CF-0070", name: "배소연", gender: "F", birthYear: 2001, phone: "010-1234-0070",
    visits: [{ visitDate: daysAgo(2), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [], sourceRaw: "유튜브 교정 영상 광고에서 봤어요" }],
  },
  // ── 4차: 같은 sourceRaw 반복 (묶음 검토 데모용) ──
  {
    chartNumber: "CF-0071", name: "정하린", gender: "F", birthYear: 1996, phone: "010-1234-0071",
    visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }],
  },
  {
    chartNumber: "CF-0072", name: "김태윤", gender: "M", birthYear: 1991, phone: "010-1234-0072",
    visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }],
  },
  {
    chartNumber: "CF-0073", name: "이서영", gender: "F", birthYear: 1988, phone: "010-1234-0073",
    visits: [{ visitDate: daysAgo(7), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }],
  },
  {
    chartNumber: "CF-0074", name: "박현서", gender: "M", birthYear: 1993, phone: "010-1234-0074",
    visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }],
  },
  {
    chartNumber: "CF-0075", name: "한소미", gender: "F", birthYear: 1995, phone: "010-1234-0075",
    visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "인스타 광고 보고 왔어요" }],
  },
  // 같은 네이버 원문 반복
  {
    chartNumber: "CF-0076", name: "조민혁", gender: "M", birthYear: 1987, phone: "010-1234-0076",
    visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }],
  },
  {
    chartNumber: "CF-0077", name: "윤서현", gender: "F", birthYear: 1990, phone: "010-1234-0077",
    visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }],
  },
  {
    chartNumber: "CF-0078", name: "강재윤", gender: "M", birthYear: 1984, phone: "010-1234-0078",
    visits: [{ visitDate: daysAgo(8), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "네이버에서 검색해서 옴" }],
  },
  // 같은 지인소개 원문 반복
  {
    chartNumber: "CF-0079", name: "임수아", gender: "F", birthYear: 1999, phone: "010-1234-0079",
    visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }],
  },
  {
    chartNumber: "CF-0080", name: "최우성", gender: "M", birthYear: 1977, phone: "010-1234-0080",
    visits: [{ visitDate: daysAgo(9), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }],
  },
  {
    chartNumber: "CF-0081", name: "남지아", gender: "F", birthYear: 1994, phone: "010-1234-0081",
    visits: [{ visitDate: daysAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }],
  },
  {
    chartNumber: "CF-0082", name: "문재영", gender: "M", birthYear: 1982, phone: "010-1234-0082",
    visits: [{ visitDate: daysAgo(11), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "지인 소개로 왔습니다" }],
  },
  // 미분류 원문 (Unknown 결과) 여러 건
  {
    chartNumber: "CF-0083", name: "배시연", gender: "F", birthYear: 2000, phone: "010-1234-0083",
    visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "기억 안나요" }],
  },
  {
    chartNumber: "CF-0084", name: "고현우", gender: "M", birthYear: 1986, phone: "010-1234-0084",
    visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "기억 안나요" }],
  },
  {
    chartNumber: "CF-0085", name: "장예진", gender: "F", birthYear: 1992, phone: "010-1234-0085",
    visits: [{ visitDate: daysAgo(5), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "잘 모르겠어요" }],
  },
  // 저신뢰 원문 (광고+비광고 혼합)
  {
    chartNumber: "CF-0086", name: "서동규", gender: "M", birthYear: 1980, phone: "010-1234-0086",
    visits: [{ visitDate: daysAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "소개받고 왔는데 광고도 봤어요" }],
  },
  {
    chartNumber: "CF-0087", name: "유채원", gender: "F", birthYear: 1997, phone: "010-1234-0087",
    visits: [{ visitDate: daysAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [], sourceRaw: "소개받고 왔는데 광고도 봤어요" }],
  },
];

const ruleConfigs = [
  { ruleType: "treatment_dropout", displayName: "치료 중단 탐지", description: "신경치료, 보철치료 중단 의심 환자를 탐지합니다.", enabled: true, parameters: JSON.stringify({ nerve_treatment_days: 14, prosthetic_days: 21 }) },
  { ruleType: "scaling_recall", displayName: "스케일링/치주 리콜", description: "보험 스케일링 미수진자와 치주 정기 리콜 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ scaling_months: 12, perio_recall_months: 4 }) },
  { ruleType: "implant_followup", displayName: "임플란트 사후관리", description: "임플란트 시술 후 정기 점검 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ implant_checkup_months: [1, 3, 6, 12] }) },
  { ruleType: "potential_demand", displayName: "잠재 수요 발굴", description: "사랑니 발치, 교정 등 상담 후 미전환 잠재 수요를 탐지합니다.", enabled: true, parameters: JSON.stringify({}) },
];

function getAutoReason(sourceRaw: string, channel: string): string {
  if (channel.startsWith("cta_")) {
    const platform = channel.replace("cta_", "");
    return `유입 경로에 '${platform}' 광고 키워드 감지. 원문: "${sourceRaw}"`;
  }
  return `채널 '${channel}'에서 자동 분류됨`;
}

// Vercel 함수 타임아웃 확장 (Hobby: 최대 60초)
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
    // 최초 설정(DB 비어있음) 또는 User 계정이 없으면 인증 없이 허용
    // (User가 없으면 로그인 자체가 불가능하므로 인증을 요구할 수 없음)
    let isFirstSetup = false;
    try {
      const [patientCount, userCount] = await Promise.all([
        prisma.patient.count(),
        prisma.user.count(),
      ]);
      // 환자 데이터가 없거나, 로그인 가능한 계정이 없으면 초기 설정으로 간주
      isFirstSetup = patientCount === 0 || userCount === 0;
    } catch {
      // 테이블 자체가 없으면 최초 설정으로 간주
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

    // ── 2단계: 사전 ID 생성 + createMany 로 벌크 INSERT ──
    // 캠페인
    const campaignMap = new Map<string, string>();
    const campaignRows = campaigns.map((c) => {
      const id = randomUUID();
      campaignMap.set(c.key, id);
      return {
        id,
        name: c.name, platform: c.platform, adType: c.adType,
        startDate: c.startDate, endDate: c.endDate || null,
        budgetWon: c.budgetWon || null, costPerClick: c.costPerClick || null,
        status: c.status,
        updatedAt: now,
      };
    });

    // 담당자
    const staffIds = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    const staffRows = [
      { id: staffIds[0], name: "김수진", role: "desk", updatedAt: now },
      { id: staffIds[1], name: "박미영", role: "counselor", updatedAt: now },
      { id: staffIds[2], name: "이원장", role: "doctor", updatedAt: now },
      { id: staffIds[3], name: "정관리", role: "manager", updatedAt: now },
    ];

    // 룰 설정
    const ruleRows = ruleConfigs.map((rc) => ({ id: randomUUID(), ...rc, updatedAt: now }));

    // 방문경로 분류 사전 (SourceRule)
    const sourceRuleMap = new Map<string, string>();
    const sourceRuleRows = DEFAULT_SOURCE_RULES.map((r) => {
      const id = randomUUID();
      sourceRuleMap.set(r.ruleName, id);
      return {
        id,
        ruleName: r.ruleName,
        keywords: JSON.stringify(r.keywords),
        normalizedSource: r.normalizedSource,
        sourceCategory: r.sourceCategory,
        ctaCandidate: r.ctaCandidate,
        priority: r.priority,
        isActive: r.isActive,
        description: r.description,
        updatedAt: now,
      };
    });

    // 환자 + identity + visit + procedure + diagnosis + leadAttribution
    const patientRows: { id: string; chartNumber: string; gender: string; birthYear: number; isVip: boolean; tags: string | null; updatedAt: Date }[] = [];
    const identityRows: { id: string; patientId: string; name: string; phone: string; updatedAt: Date }[] = [];
    const visitRows: { id: string; patientId: string; visitDate: Date; memo: string | null; sourceRaw: string | null; channel: string | null; isCta: boolean; campaignId: string | null; normalizedSource: string | null; sourceCategory: string | null; ctaCandidate: boolean | null; matchConfidence: string | null; matchReason: string | null; matchedRuleId: string | null; reviewedSource: string | null; reviewedCategory: string | null; reviewedCtaFlag: boolean | null; sourceReviewStatus: string }[] = [];
    const procedureRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const diagnosisRows: { id: string; visitId: string; code: string; name: string; tooth: string | null }[] = [];
    const leadRows: { id: string; visitId: string; campaignId: string; reviewStatus: string; autoReason: string; confidence: number; reviewer: string | null; reviewedAt: Date | null; treatmentStarted: boolean; isDuplicate: boolean; settlementMonth: string; settlementEligible: boolean; ineligibleReason: string | null; updatedAt: Date }[] = [];

    const chartToPatientId = new Map<string, string>();

    for (const p of patients) {
      const patientId = randomUUID();
      chartToPatientId.set(p.chartNumber, patientId);

      patientRows.push({
        id: patientId,
        chartNumber: p.chartNumber,
        gender: p.gender,
        birthYear: p.birthYear,
        isVip: p.isVip || false,
        tags: p.tags || null,
        updatedAt: now,
      });

      identityRows.push({
        id: randomUUID(),
        patientId,
        name: p.name,
        phone: p.phone,
        updatedAt: now,
      });

      const campaignsSeen = new Set<string>();

      for (const v of p.visits) {
        const visitId = randomUUID();
        const campaignId = v.campaignKey ? campaignMap.get(v.campaignKey) || null : null;

        // 방문경로 정규화 실행
        let norm: NormalizationResult | null = null;
        if (v.sourceRaw) {
          norm = normalizeSource(v.sourceRaw);
        }
        const matchedRuleId = norm?.matchedRuleName ? sourceRuleMap.get(norm.matchedRuleName) || null : null;
        const isHighConfidence = norm?.matchConfidence === "HIGH";

        visitRows.push({
          id: visitId,
          patientId,
          visitDate: v.visitDate,
          memo: v.memo || null,
          sourceRaw: v.sourceRaw || null,
          channel: v.channel || null,
          isCta: v.isCta || false,
          campaignId,
          normalizedSource: norm?.normalizedSource || null,
          sourceCategory: norm?.sourceCategory || null,
          ctaCandidate: norm?.ctaCandidate ?? null,
          matchConfidence: norm?.matchConfidence || null,
          matchReason: norm?.matchReason || null,
          matchedRuleId,
          reviewedSource: isHighConfidence ? norm?.normalizedSource || null : null,
          reviewedCategory: isHighConfidence ? norm?.sourceCategory || null : null,
          reviewedCtaFlag: isHighConfidence ? (norm?.ctaCandidate ?? null) : null,
          sourceReviewStatus: norm ? (isHighConfidence ? "auto_confirmed" : "unreviewed") : "unreviewed",
        });

        for (const proc of v.procedures) {
          procedureRows.push({
            id: randomUUID(),
            visitId,
            code: proc.code,
            name: proc.name,
            tooth: proc.tooth || null,
          });
        }

        for (const diag of v.diagnoses) {
          diagnosisRows.push({
            id: randomUUID(),
            visitId,
            code: diag.code,
            name: diag.name,
            tooth: diag.tooth || null,
          });
        }

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
            id: randomUUID(),
            visitId,
            campaignId,
            reviewStatus,
            autoReason: getAutoReason(v.sourceRaw || "", v.channel || ""),
            confidence: 0.7 + Math.random() * 0.25,
            reviewer: isReviewed ? "데스크 김" : null,
            reviewedAt: isReviewed ? daysAgo(Math.floor(Math.random() * 7)) : null,
            treatmentStarted,
            isDuplicate,
            settlementMonth,
            settlementEligible,
            ineligibleReason,
            updatedAt: now,
          });
        }
      }
    }

    // 워크플로우 태스크 + 활동 로그
    interface TaskSeedItem {
      actionType: string;
      status: string;
      staffIndex: number;
      note: string | null;
      reason: string | null;
      nextFollowUpDays: number | null;
    }

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

    const taskRows: { id: string; patientId: string; actionType: string; status: string; assigneeId: string | null; note: string | null; reason: string | null; nextFollowUpAt: Date | null; completedAt: Date | null; updatedAt: Date }[] = [];
    const activityRows: { id: string; taskId: string; patientId: string; staffId: string | null; action: string; fromValue: string | null; toValue: string | null }[] = [];

    for (const [chartNumber, taskItems] of Object.entries(taskSeedMap)) {
      const patientId = chartToPatientId.get(chartNumber);
      if (!patientId) continue;

      for (const ts of taskItems) {
        const taskId = randomUUID();
        const assigneeId = ts.staffIndex >= 0 ? staffIds[ts.staffIndex] : null;
        const nextFollowUpAt = ts.nextFollowUpDays !== null
          ? (() => { const d = new Date(); d.setDate(d.getDate() + ts.nextFollowUpDays); d.setHours(9, 0, 0, 0); return d; })()
          : null;

        taskRows.push({
          id: taskId, patientId, actionType: ts.actionType, status: ts.status,
          assigneeId, note: ts.note, reason: ts.reason, nextFollowUpAt,
          completedAt: ts.status === "completed" ? daysAgo(3) : null,
          updatedAt: now,
        });

        activityRows.push({
          id: randomUUID(), taskId, patientId, staffId: assigneeId,
          action: "task_created", fromValue: null, toValue: ts.actionType,
        });
        if (ts.status !== "unprocessed") {
          activityRows.push({
            id: randomUUID(), taskId, patientId, staffId: assigneeId,
            action: "status_change", fromValue: "unprocessed", toValue: ts.status,
          });
        }
        if (ts.note) {
          activityRows.push({
            id: randomUUID(), taskId, patientId, staffId: assigneeId,
            action: "note_added", fromValue: null, toValue: ts.note.substring(0, 100),
          });
        }
      }
    }

    // ── 3단계: 벌크 INSERT (의존 순서, 단계별 에러 추적) ──
    try {
      currentStep = "기본 데이터 생성 (캠페인/담당자/규칙/환자)";
      await Promise.all([
        prisma.campaign.createMany({ data: campaignRows }),
        prisma.staff.createMany({ data: staffRows }),
        prisma.ruleConfig.createMany({ data: ruleRows }),
        prisma.sourceRule.createMany({ data: sourceRuleRows }),
        prisma.patient.createMany({ data: patientRows }),
      ]);
    } catch (err) {
      console.error("[Seed] 기본 데이터 생성 실패:", err);
      return NextResponse.json(
        { error: "기본 데이터 생성 중 오류 (캠페인/담당자/규칙/환자)", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    try {
      currentStep = "환자 상세정보 생성 (신원/방문)";
      await Promise.all([
        prisma.patientIdentity.createMany({ data: identityRows }),
        prisma.visit.createMany({ data: visitRows }),
      ]);
    } catch (err) {
      console.error("[Seed] 환자 상세정보 생성 실패:", err);
      return NextResponse.json(
        { error: "환자 상세정보 생성 중 오류 (신원/방문 기록)", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    try {
      currentStep = "진료 데이터 생성 (처치/진단/CTA 귀속)";
      await Promise.all([
        prisma.procedure.createMany({ data: procedureRows }),
        prisma.diagnosis.createMany({ data: diagnosisRows }),
        prisma.leadAttribution.createMany({ data: leadRows }),
      ]);
    } catch (err) {
      console.error("[Seed] 진료 데이터 생성 실패:", err);
      return NextResponse.json(
        { error: "진료 데이터 생성 중 오류 (처치/진단/CTA)", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    try {
      currentStep = "업무 데이터 생성 (워크플로우/활동 로그)";
      await prisma.workflowTask.createMany({ data: taskRows });
      await prisma.activityLog.createMany({ data: activityRows });
    } catch (err) {
      console.error("[Seed] 업무 데이터 생성 실패:", err);
      return NextResponse.json(
        { error: "업무 데이터 생성 중 오류 (워크플로우/활동 로그)", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── 사용자 계정 생성 ──
    currentStep = "사용자 계정 생성";
    const userRows = [
      { id: randomUUID(), username: "admin", passwordHash: hashPassword("admin123"), name: "관리자 홍길동", role: "ADMIN", updatedAt: now },
      { id: randomUUID(), username: "desk01", passwordHash: hashPassword("desk123"), name: "데스크 김소연", role: "DESK", updatedAt: now },
      { id: randomUUID(), username: "desk02", passwordHash: hashPassword("desk123"), name: "데스크 이지은", role: "DESK", updatedAt: now },
      { id: randomUUID(), username: "counsel01", passwordHash: hashPassword("counsel123"), name: "상담실장 박미영", role: "COUNSELOR", updatedAt: now },
      { id: randomUUID(), username: "viewer01", passwordHash: hashPassword("view123"), name: "원장 최진수", role: "VIEWER", updatedAt: now },
      { id: randomUUID(), username: "mkt01", passwordHash: hashPassword("mkt123"), name: "마케팅 정하늘", role: "MARKETING", updatedAt: now },
    ];
    try {
      await prisma.user.createMany({ data: userRows });
    } catch (err) {
      console.error("[Seed] 사용자 계정 생성 실패:", err);
      return NextResponse.json(
        { error: "사용자 계정 생성 중 오류", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── 동기화 작업(SyncJob) 시드 ──
    currentStep = "동기화/가져오기 데이터 생성";
    const syncJobRows = [
      {
        id: randomUUID(),
        syncType: "SEED",
        sourceSystem: "seed",
        status: "SUCCESS",
        startedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 2 * 60 * 60 * 1000 + 5000),
        totalRecords: patients.length,
        successCount: patients.length,
        failedCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        unclassifiedCount: 0,
        triggeredBy: "관리자 홍길동",
        notes: "초기 시드 데이터 생성",
        updatedAt: now,
      },
      {
        id: randomUUID(),
        syncType: "CSV_IMPORT",
        sourceSystem: "csv",
        status: "PARTIAL_SUCCESS",
        startedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000 + 8000),
        totalRecords: 150,
        successCount: 142,
        failedCount: 3,
        skippedCount: 2,
        duplicateCount: 3,
        unclassifiedCount: 12,
        triggeredBy: "데스크 김소연",
        notes: "3월 방문경로 CSV 가져오기 — 일부 차트번호 매칭 실패",
        updatedAt: now,
      },
      {
        id: randomUUID(),
        syncType: "CSV_IMPORT",
        sourceSystem: "csv",
        status: "SUCCESS",
        startedAt: new Date(now.getTime() - 30 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 30 * 60 * 1000 + 3000),
        totalRecords: 50,
        successCount: 50,
        failedCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        unclassifiedCount: 2,
        triggeredBy: "데스크 김소연",
        notes: "추가 방문경로 보정 import",
        updatedAt: now,
      },
      {
        id: randomUUID(),
        syncType: "EMR_PULL",
        sourceSystem: "mock-emr",
        status: "FAILED",
        startedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000),
        finishedAt: new Date(now.getTime() - 4 * 60 * 60 * 1000 + 1500),
        totalRecords: 0,
        successCount: 0,
        failedCount: 0,
        skippedCount: 0,
        duplicateCount: 0,
        unclassifiedCount: 0,
        triggeredBy: "system",
        notes: "EMR 연동 테스트 (mock)",
        errorSummary: "EMR API 연결 실패: ECONNREFUSED 127.0.0.1:8080 — mock EMR 서버가 실행 중이 아닙니다",
        updatedAt: now,
      },
    ];
    try {
      await prisma.syncJob.createMany({ data: syncJobRows });
    } catch (err) {
      console.error("[Seed] 동기화 작업 생성 실패:", err);
      return NextResponse.json(
        { error: "동기화 작업 데이터 생성 중 오류", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── ImportBatch 시드 (리포트용) ──
    try {
      await prisma.importBatch.createMany({
        data: [
          {
            id: randomUUID(),
            fileName: "202603_방문경로_일괄.csv",
            totalRows: 150,
            successCount: 142,
            failCount: 3,
            unclassifiedCount: 12,
            reviewNeededCount: 8,
            status: "completed",
            importedBy: "데스크 김소연",
            createdAt: new Date(now.getTime() - 1 * 60 * 60 * 1000),
            updatedAt: now,
          },
          {
            id: randomUUID(),
            fileName: "202603_추가보정.csv",
            totalRows: 50,
            successCount: 50,
            failCount: 0,
            unclassifiedCount: 2,
            reviewNeededCount: 2,
            status: "completed",
            importedBy: "데스크 김소연",
            createdAt: new Date(now.getTime() - 30 * 60 * 1000),
            updatedAt: now,
          },
          {
            id: randomUUID(),
            fileName: "202602_CTA_정리.csv",
            totalRows: 80,
            successCount: 75,
            failCount: 2,
            unclassifiedCount: 5,
            reviewNeededCount: 3,
            status: "completed",
            importedBy: "관리자 홍길동",
            createdAt: daysAgo(15),
            updatedAt: now,
          },
        ],
      });
    } catch (err) {
      console.error("[Seed] ImportBatch 생성 실패:", err);
      return NextResponse.json(
        { error: "가져오기 이력 데이터 생성 중 오류", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── 완료된 업무에 completedAt 설정 (리포트용) ──
    currentStep = "후처리 (업무완료/수신거부 설정)";
    try {
      await prisma.workflowTask.updateMany({
        where: { status: "completed" },
        data: { completedAt: daysAgo(1) },
      });

      // ── 수신 거부 환자 설정 ──
      const doNotContactCharts = ["CF-0008", "CF-0016"];
      for (const chart of doNotContactCharts) {
        const pid = chartToPatientId.get(chart);
        if (pid) {
          await prisma.patient.update({
            where: { id: pid },
            data: {
              doNotContact: true,
              doNotContactAt: daysAgo(10),
              doNotContactReason: "환자 본인 요청 — 문자 수신 거부",
            },
          });
        }
      }
    } catch (err) {
      console.error("[Seed] 후처리 실패:", err);
      return NextResponse.json(
        { error: "후처리 중 오류 (업무완료/수신거부 설정)", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── 아웃바운드 메시지 시드 ──
    currentStep = "발송 메시지 데이터 생성";
    const outboundRows: {
      id: string; patientId: string; messageType: string; channel: string;
      draftMessage: string; finalMessage: string | null;
      approvalStatus: string; approvedBy: string | null; approvedAt: Date | null;
      sendStatus: string; sentAt: Date | null; failedAt: Date | null; failureReason: string | null;
      sendAttemptCount: number; provider: string | null;
      duplicateBlocked: boolean; duplicateReason: string | null;
      doNotContactBlocked: boolean;
      createdBy: string; sentBy: string | null;
      scheduledAt: Date | null;
      updatedAt: Date;
    }[] = [];

    // 1) 검토 필요 메시지 (REVIEW_NEEDED)
    const pid1 = chartToPatientId.get("CF-0001");
    if (pid1) outboundRows.push({
      id: randomUUID(), patientId: pid1, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "김민수님, 안녕하세요. OO치과입니다. 치료 중이시던 46번 치아 근관충전이 아직 완료되지 않았습니다. 빠른 시일 내 내원 부탁드립니다.",
      finalMessage: null,
      approvalStatus: "REVIEW_NEEDED", approvedBy: null, approvedAt: null,
      sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null,
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    // 2) 검토 필요 메시지 2 (REVIEW_NEEDED)
    const pid2 = chartToPatientId.get("CF-0005");
    if (pid2) outboundRows.push({
      id: randomUUID(), patientId: pid2, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "정태영님, 안녕하세요. OO치과 원장입니다. VIP 고객님의 16번 치아 근관충전이 대기 중입니다. 편하신 시간에 연락 주시면 감사하겠습니다.",
      finalMessage: null,
      approvalStatus: "REVIEW_NEEDED", approvedBy: null, approvedAt: null,
      sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null,
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "상담실장 박미영", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    // 3) 승인 완료 → 발송 대기 (APPROVED + PENDING)
    const pid3 = chartToPatientId.get("CF-0006");
    if (pid3) outboundRows.push({
      id: randomUUID(), patientId: pid3, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "한지은님, 크라운 제작이 완료되었습니다. 빠른 시일 내 내원하여 세팅 받으시길 권합니다.",
      finalMessage: "한지은님, 안녕하세요. OO치과입니다. 크라운 제작이 완료되었습니다. 편하신 시간에 내원하여 세팅 받으시길 권합니다. (☎ 02-1234-5678)",
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(1),
      sendStatus: "PENDING", sentAt: null, failedAt: null, failureReason: null,
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    // 4) 예약 발송 (APPROVED + SCHEDULED)
    const pid4 = chartToPatientId.get("CF-0013");
    if (pid4) {
      const scheduledTime = new Date();
      scheduledTime.setDate(scheduledTime.getDate() + 1);
      scheduledTime.setHours(10, 0, 0, 0);
      outboundRows.push({
        id: randomUUID(), patientId: pid4, messageType: "SCALING_REMINDER", channel: "KAKAO",
        draftMessage: "남궁석님, 보험 스케일링 수진 시기가 지났습니다. 치주 건강을 위해 내원 부탁드립니다.",
        finalMessage: "남궁석님, 안녕하세요. OO치과입니다. 보험 스케일링 수진 시기가 도래하였습니다. 치주 건강 관리를 위해 빠른 내원 부탁드립니다.",
        approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(2),
        sendStatus: "SCHEDULED", sentAt: null, failedAt: null, failureReason: null,
        sendAttemptCount: 0, provider: null,
        duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
        createdBy: "데스크 김소연", sentBy: null, scheduledAt: scheduledTime, updatedAt: now,
      });
    }

    // 5) 발송 완료 (SENT)
    const pid5 = chartToPatientId.get("CF-0018");
    if (pid5) outboundRows.push({
      id: randomUUID(), patientId: pid5, messageType: "RECALL", channel: "KAKAO",
      draftMessage: "문정훈님, 임플란트 정기 점검 시기입니다.",
      finalMessage: "문정훈님, 안녕하세요. OO치과입니다. 임플란트(#36) 정기 점검 시기가 되었습니다. 편하신 시간에 내원 부탁드립니다.",
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(5),
      sendStatus: "SENT", sentAt: daysAgo(4), failedAt: null, failureReason: null,
      sendAttemptCount: 1, provider: "mock",
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now,
    });

    // 6) 발송 완료 2
    const pid6 = chartToPatientId.get("CF-0022");
    if (pid6) outboundRows.push({
      id: randomUUID(), patientId: pid6, messageType: "RECALL", channel: "KAKAO",
      draftMessage: "류태완님, 임플란트 3개월 점검 안내입니다.",
      finalMessage: "류태완님, 안녕하세요. OO치과입니다. 임플란트(#35) 3개월 정기 점검일이 지났습니다. 보호자님께서 예약 연락 주시면 감사하겠습니다.",
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(7),
      sendStatus: "SENT", sentAt: daysAgo(6), failedAt: null, failureReason: null,
      sendAttemptCount: 1, provider: "mock",
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now,
    });

    // 7) 발송 실패 (FAILED)
    const pid7 = chartToPatientId.get("CF-0003");
    if (pid7) outboundRows.push({
      id: randomUUID(), patientId: pid7, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "박준호님, 치료 중이시던 46번 치아 신경치료가 아직 완료되지 않았습니다.",
      finalMessage: "박준호님, 안녕하세요. OO치과입니다. 46번 치아 신경치료가 진행 중입니다. 빠른 시일 내 내원하여 치료를 완료하시길 권합니다.",
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(3),
      sendStatus: "FAILED", sentAt: null, failedAt: daysAgo(2), failureReason: "카카오 알림톡 발송 실패: 유효하지 않은 수신번호",
      sendAttemptCount: 2, provider: "mock",
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 김소연", sentBy: "데스크 김소연", scheduledAt: null, updatedAt: now,
    });

    // 8) 수신 거부로 차단 (BLOCKED + doNotContactBlocked)
    const pid8 = chartToPatientId.get("CF-0008");
    if (pid8) outboundRows.push({
      id: randomUUID(), patientId: pid8, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "윤다혜님, 보철 치료가 대기 중입니다.",
      finalMessage: null,
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(4),
      sendStatus: "BLOCKED", sentAt: null, failedAt: null, failureReason: "수신 거부 환자",
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: true,
      createdBy: "데스크 김소연", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    // 9) 중복 차단 (BLOCKED + duplicateBlocked)
    const pid9 = chartToPatientId.get("CF-0018");
    if (pid9) outboundRows.push({
      id: randomUUID(), patientId: pid9, messageType: "RECALL", channel: "KAKAO",
      draftMessage: "문정훈님, 임플란트 점검 시기 재안내입니다.",
      finalMessage: null,
      approvalStatus: "APPROVED", approvedBy: "관리자 홍길동", approvedAt: daysAgo(2),
      sendStatus: "BLOCKED", sentAt: null, failedAt: null, failureReason: "7일 이내 동일 환자 동일 유형 발송 이력 있음",
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: true, duplicateReason: "7일 이내 RECALL 유형 메시지 발송 이력 존재", doNotContactBlocked: false,
      createdBy: "상담실장 박미영", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    // 10) 반려된 메시지 (REJECTED + CANCELLED)
    const pid10 = chartToPatientId.get("CF-0002");
    if (pid10) outboundRows.push({
      id: randomUUID(), patientId: pid10, messageType: "TREATMENT_RESUME", channel: "KAKAO",
      draftMessage: "이영희님, 치료 중단된 36번 치아 신경치료를 완료해 주세요.",
      finalMessage: null,
      approvalStatus: "REJECTED", approvedBy: null, approvedAt: null,
      sendStatus: "CANCELLED", sentAt: null, failedAt: null, failureReason: null,
      sendAttemptCount: 0, provider: null,
      duplicateBlocked: false, duplicateReason: null, doNotContactBlocked: false,
      createdBy: "데스크 이지은", sentBy: null, scheduledAt: null, updatedAt: now,
    });

    try {
      if (outboundRows.length > 0) {
        await prisma.outboundMessage.createMany({ data: outboundRows });
      }
    } catch (err) {
      console.error("[Seed] 발송 메시지 생성 실패:", err);
      return NextResponse.json(
        { error: "발송 메시지 데이터 생성 중 오류", step: currentStep, detail: err instanceof Error ? err.message : String(err) },
        { status: 500 }
      );
    }

    // ── 감사 로그 ──
    currentStep = "완료 기록";
    try {
      await prisma.auditLog.create({
        data: {
          action: "seed_data",
          entityType: "system",
          entityId: "seed",
          detail: JSON.stringify({ patientCount: patients.length, campaignCount: campaigns.length, taskCount: taskRows.length, staffCount: staffRows.length, ctaLeadCount: leadRows.length, sourceRuleCount: sourceRuleRows.length, userCount: userRows.length, syncJobCount: syncJobRows.length, outboundMessageCount: outboundRows.length }),
        },
      });
    } catch (err) {
      // 감사 로그 실패는 치명적이지 않으므로 경고만
      console.warn("[Seed] 감사 로그 기록 실패 (무시):", err);
    }

    return NextResponse.json({
      success: true,
      message: `${patients.length}명의 환자, ${campaigns.length}개의 캠페인, ${leadRows.length}개의 CTA 귀속, ${sourceRuleRows.length}개의 분류 규칙, ${taskRows.length}개의 업무, ${staffRows.length}명의 담당자, ${userRows.length}명의 사용자, ${syncJobRows.length}개의 동기화 작업, ${outboundRows.length}개의 발송 메시지가 생성되었습니다.`,
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
