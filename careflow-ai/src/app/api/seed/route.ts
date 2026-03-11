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

interface SeedPatient {
  chartNumber: string;
  name: string;
  gender: string;
  birthYear: number;
  phone: string;
  memo?: string;
  isVip?: boolean;
  visits: {
    visitDate: Date;
    memo?: string;
    procedures: { code: string; name: string; tooth?: string }[];
    diagnoses: { code: string; name: string; tooth?: string }[];
  }[];
}

const patients: SeedPatient[] = [
  {
    chartNumber: "CF-0001", name: "김민수", gender: "M", birthYear: 1985, phone: "010-1234-0001",
    memo: "IT기업 과장. 야근 잦아 예약 자주 취소. 통증 사라지면 안 옴",
    visits: [
      { visitDate: daysAgo(60), memo: "우측 하악 통증 주소", procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "46" }] },
      { visitDate: daysAgo(53), memo: "신경치료 시작", procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }] },
      { visitDate: daysAgo(46), memo: "근관성형 진행. 다음주 충전 예약", procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "46" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0002", name: "이영희", gender: "F", birthYear: 1990, phone: "010-1234-0002",
    memo: "통증 없어지면 치료 중단 이력 있음",
    visits: [
      { visitDate: daysAgo(20), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "36" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "36" }] },
      { visitDate: daysAgo(13), procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "36" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0003", name: "박준호", gender: "M", birthYear: 1978, phone: "010-1234-0003",
    memo: "치과 공포증. 마취 관련 불안감 있음",
    visits: [
      { visitDate: daysAgo(40), procedures: [{ code: "U4413", name: "발수(복수근관)", tooth: "46" }], diagnoses: [{ code: "K041", name: "치수괴사", tooth: "46" }] },
    ],
  },
  {
    chartNumber: "CF-0004", name: "최서연", gender: "F", birthYear: 1995, phone: "010-1234-0004",
    visits: [
      { visitDate: daysAgo(18), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }] },
    ],
  },
  {
    chartNumber: "CF-0005", name: "정태영", gender: "M", birthYear: 1982, phone: "010-1234-0005",
    isVip: true, memo: "가족(4인) 모두 본원 환자. 매출 상위 5%",
    visits: [
      { visitDate: monthsAgo(6), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
      { visitDate: daysAgo(30), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "16" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "16" }] },
      { visitDate: daysAgo(23), procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "16" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0006", name: "한지은", gender: "F", birthYear: 1988, phone: "010-1234-0006",
    memo: "크라운 인상 후 비용 문제로 보류 추정",
    visits: [
      { visitDate: daysAgo(45), procedures: [{ code: "U6020", name: "보철 prep", tooth: "26" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "26" }] },
      { visitDate: daysAgo(30), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "26" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0007", name: "오승민", gender: "M", birthYear: 1975, phone: "010-1234-0007",
    isVip: true, memo: "사업가. 해외 출장 잦음",
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
    visits: [{ visitDate: daysAgo(25), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "47" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0010", name: "서미라", gender: "F", birthYear: 1987, phone: "010-1234-0010",
    visits: [{ visitDate: daysAgo(28), procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "15" }], diagnoses: [{ code: "K083", name: "잔존 치근", tooth: "15" }] }],
  },
  {
    chartNumber: "CF-0011", name: "임재현", gender: "M", birthYear: 1970, phone: "010-1234-0011",
    memo: "매년 스케일링 안내 시 내원. 올해 미방문",
    visits: [{ visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0012", name: "조은별", gender: "F", birthYear: 1993, phone: "010-1234-0012",
    visits: [{ visitDate: monthsAgo(13), procedures: [{ code: "U2231", name: "치석제거(2/3악)" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0013", name: "남궁석", gender: "M", birthYear: 1965, phone: "010-1234-0013",
    memo: "만성치주염 10년차. 3~4개월 주기 관리 필수", isVip: true,
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
    memo: "치주판막술 경험. 관리 순응도 높은 편이나 최근 미내원",
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
    visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "U1040", name: "치주치료" }, { code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [{ code: "K052", name: "급성치주염" }] }],
  },
  {
    chartNumber: "CF-0018", name: "문정훈", gender: "M", birthYear: 1963, phone: "010-1234-0018",
    isVip: true, memo: "임플란트 2개 이력. 당뇨 관리 중. 임플란트 주위염 예방 중요",
    visits: [
      { visitDate: monthsAgo(8), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [{ code: "K081", name: "치아상실", tooth: "36" }] },
      { visitDate: monthsAgo(5), procedures: [{ code: "U4451", name: "임플란트 2차 수술", tooth: "36" }], diagnoses: [] },
      { visitDate: monthsAgo(2), memo: "최종 보철 세팅", procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0019", name: "유하나", gender: "F", birthYear: 1958, phone: "010-1234-0019",
    memo: "골다공증 약 복용 중",
    visits: [
      { visitDate: monthsAgo(4), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "46" }], diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "46" }] },
      { visitDate: monthsAgo(3), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "46" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0020", name: "황인석", gender: "M", birthYear: 1955, phone: "010-1234-0020",
    visits: [
      { visitDate: monthsAgo(7), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "16" }], diagnoses: [] },
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
    isVip: true, memo: "75세 고령. 틀니→임플란트 전환",
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
      { visitDate: monthsAgo(2), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "45" }], diagnoses: [] },
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
    visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }] }],
  },
  {
    chartNumber: "CF-0027", name: "노현수", gender: "M", birthYear: 1996, phone: "010-1234-0027",
    visits: [{ visitDate: monthsAgo(6), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }] }],
  },
  {
    chartNumber: "CF-0028", name: "하은채", gender: "F", birthYear: 2000, phone: "010-1234-0028",
    memo: "양쪽 사랑니 매복. 발치 고민 중",
    visits: [{ visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }, { code: "K018", name: "매복치 기타", tooth: "28" }] }],
  },
  {
    chartNumber: "CF-0029", name: "구본철", gender: "M", birthYear: 1994, phone: "010-1234-0029",
    visits: [{ visitDate: monthsAgo(4), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }] }],
  },
  {
    chartNumber: "CF-0030", name: "피수연", gender: "F", birthYear: 1997, phone: "010-1234-0030",
    visits: [{ visitDate: monthsAgo(1), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }] }],
  },
  {
    chartNumber: "CF-0031", name: "양서준", gender: "M", birthYear: 2002, phone: "010-1234-0031",
    visits: [{ visitDate: monthsAgo(5), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [{ code: "K070", name: "악안면 이상" }] }],
  },
  {
    chartNumber: "CF-0032", name: "도하영", gender: "F", birthYear: 2001, phone: "010-1234-0032",
    visits: [{ visitDate: monthsAgo(3), procedures: [{ code: "ZZ002", name: "교정 검사" }], diagnoses: [{ code: "K071", name: "상하악 관계 이상" }] }],
  },
  {
    chartNumber: "CF-0033", name: "원세훈", gender: "M", birthYear: 2003, phone: "010-1234-0033",
    visits: [{ visitDate: monthsAgo(7), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0034", name: "탁지민", gender: "F", birthYear: 1999, phone: "010-1234-0034",
    memo: "교정 상담+검사 완료. 비용 상담 후 보류",
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
    visits: [{ visitDate: daysAgo(7), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0037", name: "공다은", gender: "F", birthYear: 1991, phone: "010-1234-0037",
    visits: [{ visitDate: daysAgo(3), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [] }],
  },
  {
    chartNumber: "CF-0038", name: "석진우", gender: "M", birthYear: 1979, phone: "010-1234-0038",
    memo: "신경치료+근관충전 완료 (정상 종료)",
    visits: [{ visitDate: daysAgo(14), procedures: [{ code: "U4411", name: "발수(전치)", tooth: "22" }, { code: "U4414", name: "근관충전(전치)", tooth: "22" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "22" }] }],
  },
  {
    chartNumber: "CF-0039", name: "주현아", gender: "F", birthYear: 1984, phone: "010-1234-0039",
    memo: "크라운 세팅 완료 (정상 종료)",
    visits: [
      { visitDate: daysAgo(10), procedures: [{ code: "U6010", name: "크라운 인상", tooth: "46" }], diagnoses: [] },
      { visitDate: daysAgo(3), procedures: [{ code: "U6030", name: "크라운 세팅", tooth: "46" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0040", name: "방시혁", gender: "M", birthYear: 1972, phone: "010-1234-0040",
    isVip: true,
    visits: [
      { visitDate: daysAgo(5), procedures: [{ code: "U0001", name: "정기검진" }], diagnoses: [] },
      { visitDate: monthsAgo(3), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0041", name: "위지수", gender: "F", birthYear: 1995, phone: "010-1234-0041",
    visits: [{ visitDate: daysAgo(1), procedures: [{ code: "U0001", name: "충전(레진)", tooth: "15" }], diagnoses: [{ code: "K029", name: "치아우식증", tooth: "15" }] }],
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
    isVip: true, memo: "전체 치료 계획 진행 중. 고혈압. 최고 우선 관리",
    visits: [
      { visitDate: monthsAgo(18), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
      { visitDate: monthsAgo(6), procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }], diagnoses: [] },
      { visitDate: monthsAgo(5), procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }], diagnoses: [] },
      { visitDate: monthsAgo(4), procedures: [{ code: "U4412", name: "발수(구치)", tooth: "47" }], diagnoses: [{ code: "K040", name: "치수염", tooth: "47" }] },
    ],
  },
  {
    chartNumber: "CF-0044", name: "진소라", gender: "F", birthYear: 1985, phone: "010-1234-0044",
    memo: "치주 관리 중 + 교정 고민. 비용 부담 언급",
    visits: [
      { visitDate: monthsAgo(14), procedures: [{ code: "U2230", name: "치석제거(1/3악)" }], diagnoses: [] },
      { visitDate: monthsAgo(5), procedures: [{ code: "U1010", name: "치주소파술" }], diagnoses: [{ code: "K053", name: "만성치주염" }] },
      { visitDate: monthsAgo(3), procedures: [{ code: "ZZ001", name: "교정 상담" }], diagnoses: [] },
    ],
  },
  {
    chartNumber: "CF-0045", name: "채영수", gender: "M", birthYear: 1957, phone: "010-1234-0045",
    isVip: true, memo: "장기 VIP. 임플란트 3개 이력. 정기관리 충실했으나 최근 미내원",
    visits: [
      { visitDate: monthsAgo(20), procedures: [{ code: "U2232", name: "치석제거(전악)" }], diagnoses: [] },
      { visitDate: monthsAgo(8), procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "25" }], diagnoses: [] },
      { visitDate: monthsAgo(7), procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "25" }], diagnoses: [] },
      { visitDate: monthsAgo(2), procedures: [{ code: "U0001", name: "검진" }], diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }] },
    ],
  },
];

const ruleConfigs = [
  { ruleType: "treatment_dropout", displayName: "치료 중단 탐지", description: "신경치료, 보철치료 중단 의심 환자를 탐지합니다.", enabled: true, parameters: JSON.stringify({ nerve_treatment_days: 14, prosthetic_days: 21 }) },
  { ruleType: "scaling_recall", displayName: "스케일링/치주 리콜", description: "보험 스케일링 미수진자와 치주 정기 리콜 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ scaling_months: 12, perio_recall_months: 4 }) },
  { ruleType: "implant_followup", displayName: "임플란트 사후관리", description: "임플란트 시술 후 정기 점검 대상을 탐지합니다.", enabled: true, parameters: JSON.stringify({ implant_checkup_months: [1, 3, 6, 12] }) },
  { ruleType: "potential_demand", displayName: "잠재 수요 발굴", description: "사랑니 발치, 교정 등 상담 후 미전환 잠재 수요를 탐지합니다.", enabled: true, parameters: JSON.stringify({}) },
];

export async function POST() {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json(
        { error: "데이터베이스에 연결할 수 없습니다. DATABASE_URL 환경변수를 확인해 주세요." },
        { status: 503 }
      );
    }

    // 기존 데이터 삭제
    await prisma.messageDraft.deleteMany();
    await prisma.recallRecommendation.deleteMany();
    await prisma.diagnosis.deleteMany();
    await prisma.procedure.deleteMany();
    await prisma.visit.deleteMany();
    await prisma.patient.deleteMany();
    await prisma.ruleConfig.deleteMany();

    for (const p of patients) {
      const patient = await prisma.patient.create({
        data: {
          chartNumber: p.chartNumber, name: p.name, gender: p.gender,
          birthYear: p.birthYear, phone: p.phone,
          memo: p.memo || null, isVip: p.isVip || false,
        },
      });
      for (const v of p.visits) {
        await prisma.visit.create({
          data: {
            patientId: patient.id, visitDate: v.visitDate, memo: v.memo || null,
            procedures: { create: v.procedures.map((proc) => ({ code: proc.code, name: proc.name, tooth: proc.tooth || null })) },
            diagnoses: { create: v.diagnoses.map((diag) => ({ code: diag.code, name: diag.name, tooth: diag.tooth || null })) },
          },
        });
      }
    }

    for (const rc of ruleConfigs) {
      await prisma.ruleConfig.create({ data: rc });
    }

    return NextResponse.json({
      success: true,
      message: `${patients.length}명의 환자 데이터와 ${ruleConfigs.length}개의 규칙 설정이 생성되었습니다.`,
    });
  } catch (error) {
    console.error("Seed API error:", error);
    return NextResponse.json(
      { error: "데이터 초기화 중 오류가 발생했습니다. 데이터베이스 스키마가 올바른지 확인해 주세요." },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const dbAvailable = await isDatabaseAvailable();
    if (!dbAvailable) {
      return NextResponse.json({ status: "db_unavailable", patientCount: 0 });
    }
    const count = await prisma.patient.count();
    return NextResponse.json({ status: "ok", patientCount: count });
  } catch {
    return NextResponse.json({ status: "error", patientCount: 0 });
  }
}
