import { NextResponse } from "next/server";
import { prisma, isDatabaseAvailable } from "@/lib/prisma";

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

export async function POST() {
  try {
    const dbCheck = await isDatabaseAvailable();
    if (!dbCheck.available) {
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다. DATABASE_URL 환경변수를 확인해 주세요.", detail: dbCheck.error },
        { status: 503 }
      );
    }

    // 기존 데이터 삭제 (FK 의존성 순서)
    await prisma.activityLog.deleteMany();
    await prisma.workflowTask.deleteMany();
    await prisma.staff.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.messageDelivery.deleteMany();
    await prisma.leadAttribution.deleteMany();
    await prisma.messageDraft.deleteMany();
    await prisma.recallRecommendation.deleteMany();
    await prisma.diagnosis.deleteMany();
    await prisma.procedure.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.patientIdentity.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.campaign.deleteMany();
    await prisma.ruleConfig.deleteMany();

    // 캠페인 생성
    const campaignMap = new Map<string, string>();
    for (const c of campaigns) {
      const campaign = await prisma.campaign.create({
        data: {
          name: c.name,
          platform: c.platform,
          adType: c.adType,
          startDate: c.startDate,
          endDate: c.endDate || null,
          budgetWon: c.budgetWon || null,
          costPerClick: c.costPerClick || null,
          status: c.status,
        },
      });
      campaignMap.set(c.key, campaign.id);
    }

    // 환자 + PatientIdentity + Visit + LeadAttribution
    // 중복 환자 추적: patientId → campaignKey 세트
    const ctaPatientCampaigns = new Map<string, Set<string>>();

    for (const p of patients) {
      const patient = await prisma.patient.create({
        data: {
          chartNumber: p.chartNumber,
          gender: p.gender,
          birthYear: p.birthYear,
          isVip: p.isVip || false,
          tags: p.tags || null,
        },
      });

      await prisma.patientIdentity.create({
        data: {
          patientId: patient.id,
          name: p.name,
          phone: p.phone,
        },
      });

      for (const v of p.visits) {
        const campaignId = v.campaignKey ? campaignMap.get(v.campaignKey) : undefined;

        const visit = await prisma.visit.create({
          data: {
            patientId: patient.id,
            visitDate: v.visitDate,
            memo: v.memo || null,
            sourceRaw: v.sourceRaw || null,
            channel: v.channel || null,
            isCta: v.isCta || false,
            campaignId: campaignId || null,
            procedures: {
              create: v.procedures.map((proc) => ({
                code: proc.code,
                name: proc.name,
                tooth: proc.tooth || null,
              })),
            },
            diagnoses: {
              create: v.diagnoses.map((diag) => ({
                code: diag.code,
                name: diag.name,
                tooth: diag.tooth || null,
              })),
            },
          },
        });

        if (v.isCta && campaignId) {
          // 중복 환자 체크: 같은 환자가 같은 캠페인에 이미 있으면 중복
          const patientCampaigns = ctaPatientCampaigns.get(patient.id) || new Set();
          const isDuplicate = patientCampaigns.has(v.campaignKey || "");
          patientCampaigns.add(v.campaignKey || "");
          ctaPatientCampaigns.set(patient.id, patientCampaigns);

          const treatmentStarted = v.hasTreatment ?? true;
          const isConfirmed = Math.random() > 0.35;
          const reviewStatus = isConfirmed ? "confirmed" : "pending";

          // 정산 인정: 확정 + 진료 시작 + 중복 아님
          const settlementEligible = reviewStatus === "confirmed" && treatmentStarted && !isDuplicate;
          let ineligibleReason: string | null = null;
          if (!settlementEligible) {
            if (reviewStatus !== "confirmed") ineligibleReason = "검토 대기 중";
            else if (!treatmentStarted) ineligibleReason = "실제 진료 미시작 (상담/검사만)";
            else if (isDuplicate) ineligibleReason = "동일 환자 중복 유입 (1회만 인정)";
          }

          const settlementMonth = `${v.visitDate.getFullYear()}-${String(v.visitDate.getMonth() + 1).padStart(2, "0")}`;

          await prisma.leadAttribution.create({
            data: {
              visitId: visit.id,
              campaignId,
              reviewStatus,
              autoReason: getAutoReason(v.sourceRaw || "", v.channel || ""),
              confidence: 0.7 + Math.random() * 0.25,
              reviewer: isConfirmed ? "데스크 김" : null,
              reviewedAt: isConfirmed ? daysAgo(Math.floor(Math.random() * 7)) : null,
              treatmentStarted,
              isDuplicate,
              settlementMonth,
              settlementEligible,
              ineligibleReason,
            },
          });
        }
      }
    }

    for (const rc of ruleConfigs) {
      await prisma.ruleConfig.create({ data: rc });
    }

    // ── 담당자 생성 ──
    const staffMembers = [
      { name: "김수진", role: "desk" },
      { name: "박미영", role: "counselor" },
      { name: "이원장", role: "doctor" },
      { name: "정관리", role: "manager" },
    ];
    const createdStaff = [];
    for (const sm of staffMembers) {
      const s = await prisma.staff.create({ data: sm });
      createdStaff.push(s);
    }

    // ── 워크플로우 태스크 생성 ──
    const allPatients = await prisma.patient.findMany({ select: { id: true, chartNumber: true } });
    const chartToId: Record<string, string> = {};
    for (const p of allPatients) {
      chartToId[p.chartNumber] = p.id;
    }

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

    let taskCount = 0;
    for (const [chartNumber, taskItems] of Object.entries(taskSeedMap)) {
      const patientId = chartToId[chartNumber];
      if (!patientId) continue;

      for (const ts of taskItems) {
        const assigneeId = ts.staffIndex >= 0 ? createdStaff[ts.staffIndex].id : null;
        const nextFollowUpAt = ts.nextFollowUpDays !== null
          ? (() => { const d = new Date(); d.setDate(d.getDate() + ts.nextFollowUpDays); d.setHours(9, 0, 0, 0); return d; })()
          : null;

        const task = await prisma.workflowTask.create({
          data: {
            patientId,
            actionType: ts.actionType,
            status: ts.status,
            assigneeId,
            note: ts.note,
            reason: ts.reason,
            nextFollowUpAt,
            completedAt: ts.status === "completed" ? daysAgo(3) : null,
          },
        });

        await prisma.activityLog.create({
          data: { taskId: task.id, patientId, staffId: assigneeId, action: "task_created", toValue: ts.actionType },
        });
        if (ts.status !== "unprocessed") {
          await prisma.activityLog.create({
            data: { taskId: task.id, patientId, staffId: assigneeId, action: "status_change", fromValue: "unprocessed", toValue: ts.status },
          });
        }
        if (ts.note) {
          await prisma.activityLog.create({
            data: { taskId: task.id, patientId, staffId: assigneeId, action: "note_added", toValue: ts.note.substring(0, 100) },
          });
        }
        taskCount++;
      }
    }

    await prisma.auditLog.create({
      data: {
        action: "seed_data",
        entityType: "system",
        entityId: "seed",
        detail: JSON.stringify({ patientCount: patients.length, campaignCount: campaigns.length, taskCount, staffCount: createdStaff.length }),
      },
    });

    return NextResponse.json({
      success: true,
      message: `${patients.length}명의 환자, ${campaigns.length}개의 캠페인, ${taskCount}개의 업무, ${createdStaff.length}명의 담당자가 생성되었습니다.`,
    });
  } catch (error) {
    console.error("Seed API error:", error);
    const errMsg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "데이터 초기화 중 오류가 발생했습니다.", detail: errMsg },
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
