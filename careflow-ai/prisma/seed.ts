import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

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

interface PatientSeed {
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

const patients: PatientSeed[] = [
  // === 1~5: 신경치료 중단 의심 ===
  {
    chartNumber: "CF-0001",
    name: "김민수",
    gender: "M",
    birthYear: 1985,
    phone: "010-1234-0001",
    memo: "직장인, 바쁜 스케줄",
    visits: [
      {
        visitDate: daysAgo(25),
        procedures: [{ code: "U4411", name: "발수(전치)", tooth: "11" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "11" }],
      },
    ],
  },
  {
    chartNumber: "CF-0002",
    name: "이영희",
    gender: "F",
    birthYear: 1990,
    phone: "010-1234-0002",
    visits: [
      {
        visitDate: daysAgo(20),
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "36" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "36" }],
      },
      {
        visitDate: daysAgo(13),
        procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "36" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0003",
    name: "박준호",
    gender: "M",
    birthYear: 1978,
    phone: "010-1234-0003",
    memo: "통증에 민감",
    visits: [
      {
        visitDate: daysAgo(40),
        procedures: [{ code: "U4413", name: "발수(복수근관)", tooth: "46" }],
        diagnoses: [{ code: "K041", name: "치수괴사", tooth: "46" }],
      },
    ],
  },
  {
    chartNumber: "CF-0004",
    name: "최서연",
    gender: "F",
    birthYear: 1995,
    phone: "010-1234-0004",
    visits: [
      {
        visitDate: daysAgo(18),
        procedures: [{ code: "U4411", name: "발수(전치)", tooth: "21" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "21" }],
      },
    ],
  },
  {
    chartNumber: "CF-0005",
    name: "정태영",
    gender: "M",
    birthYear: 1982,
    phone: "010-1234-0005",
    isVip: true,
    visits: [
      {
        visitDate: daysAgo(30),
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "16" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "16" }],
      },
      {
        visitDate: daysAgo(23),
        procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "16" }],
        diagnoses: [],
      },
    ],
  },

  // === 6~10: 보철 중단 의심 ===
  {
    chartNumber: "CF-0006",
    name: "한지은",
    gender: "F",
    birthYear: 1988,
    phone: "010-1234-0006",
    visits: [
      {
        visitDate: daysAgo(30),
        procedures: [{ code: "U6010", name: "크라운 인상", tooth: "26" }],
        diagnoses: [{ code: "K029", name: "치아우식증", tooth: "26" }],
      },
    ],
  },
  {
    chartNumber: "CF-0007",
    name: "오승민",
    gender: "M",
    birthYear: 1975,
    phone: "010-1234-0007",
    isVip: true,
    visits: [
      {
        visitDate: daysAgo(35),
        procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "35" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0008",
    name: "윤다혜",
    gender: "F",
    birthYear: 1992,
    phone: "010-1234-0008",
    visits: [
      {
        visitDate: daysAgo(50),
        procedures: [{ code: "U6020", name: "보철 prep", tooth: "14" }],
        diagnoses: [{ code: "K030", name: "치아마모증", tooth: "14" }],
      },
    ],
  },
  {
    chartNumber: "CF-0009",
    name: "강현우",
    gender: "M",
    birthYear: 1980,
    phone: "010-1234-0009",
    visits: [
      {
        visitDate: daysAgo(25),
        procedures: [{ code: "U6010", name: "크라운 인상", tooth: "47" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0010",
    name: "서미라",
    gender: "F",
    birthYear: 1987,
    phone: "010-1234-0010",
    visits: [
      {
        visitDate: daysAgo(28),
        procedures: [{ code: "U6011", name: "브릿지 인상", tooth: "15" }],
        diagnoses: [{ code: "K083", name: "잔존 치근", tooth: "15" }],
      },
    ],
  },

  // === 11~17: 스케일링/치주 리콜 대상 ===
  {
    chartNumber: "CF-0011",
    name: "임재현",
    gender: "M",
    birthYear: 1970,
    phone: "010-1234-0011",
    visits: [
      {
        visitDate: monthsAgo(14),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0012",
    name: "조은별",
    gender: "F",
    birthYear: 1993,
    phone: "010-1234-0012",
    visits: [
      {
        visitDate: monthsAgo(13),
        procedures: [{ code: "U2231", name: "치석제거(2/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0013",
    name: "남궁석",
    gender: "M",
    birthYear: 1965,
    phone: "010-1234-0013",
    memo: "치주질환 이력, 정기관리 중요",
    isVip: true,
    visits: [
      {
        visitDate: monthsAgo(16),
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(10),
        procedures: [{ code: "U1010", name: "치주소파술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
      {
        visitDate: monthsAgo(5),
        procedures: [{ code: "U1020", name: "치근활택술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
    ],
  },
  {
    chartNumber: "CF-0014",
    name: "배소영",
    gender: "F",
    birthYear: 1972,
    phone: "010-1234-0014",
    visits: [
      {
        visitDate: monthsAgo(15),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0015",
    name: "신동혁",
    gender: "M",
    birthYear: 1968,
    phone: "010-1234-0015",
    visits: [
      {
        visitDate: monthsAgo(8),
        procedures: [{ code: "U1030", name: "치주판막술" }],
        diagnoses: [{ code: "K054", name: "치주증" }],
      },
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U1010", name: "치주소파술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
    ],
  },
  {
    chartNumber: "CF-0016",
    name: "장미경",
    gender: "F",
    birthYear: 1960,
    phone: "010-1234-0016",
    visits: [
      {
        visitDate: monthsAgo(18),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0017",
    name: "고윤성",
    gender: "M",
    birthYear: 1983,
    phone: "010-1234-0017",
    visits: [
      {
        visitDate: monthsAgo(7),
        procedures: [
          { code: "U1040", name: "치주치료" },
          { code: "U2230", name: "치석제거(1/3악)" },
        ],
        diagnoses: [{ code: "K052", name: "급성치주염" }],
      },
    ],
  },

  // === 18~25: 임플란트 사후관리 대상 ===
  {
    chartNumber: "CF-0018",
    name: "문정훈",
    gender: "M",
    birthYear: 1963,
    phone: "010-1234-0018",
    isVip: true,
    visits: [
      {
        visitDate: monthsAgo(2),
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }],
        diagnoses: [{ code: "K081", name: "사고로 인한 치아상실", tooth: "36" }],
      },
      {
        visitDate: monthsAgo(1),
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0019",
    name: "유하나",
    gender: "F",
    birthYear: 1958,
    phone: "010-1234-0019",
    visits: [
      {
        visitDate: monthsAgo(4),
        procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "46" }],
        diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "46" }],
      },
      {
        visitDate: monthsAgo(3),
        procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "46" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0020",
    name: "황인석",
    gender: "M",
    birthYear: 1955,
    phone: "010-1234-0020",
    visits: [
      {
        visitDate: monthsAgo(7),
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "16" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "16" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0021",
    name: "전소희",
    gender: "F",
    birthYear: 1973,
    phone: "010-1234-0021",
    visits: [
      {
        visitDate: monthsAgo(13),
        procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "26" }],
        diagnoses: [{ code: "K082", name: "치조골 위축", tooth: "26" }],
      },
      {
        visitDate: monthsAgo(12),
        procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "26" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0022",
    name: "류태완",
    gender: "M",
    birthYear: 1950,
    phone: "010-1234-0022",
    isVip: true,
    visits: [
      {
        visitDate: monthsAgo(5),
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "35" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(4),
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "35" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0023",
    name: "권지영",
    gender: "F",
    birthYear: 1966,
    phone: "010-1234-0023",
    visits: [
      {
        visitDate: monthsAgo(14),
        procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "47" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(13),
        procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "47" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0024",
    name: "차민재",
    gender: "M",
    birthYear: 1975,
    phone: "010-1234-0024",
    visits: [
      {
        visitDate: monthsAgo(2),
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "45" }],
        diagnoses: [],
      },
      {
        visitDate: daysAgo(20),
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "45" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0025",
    name: "안유진",
    gender: "F",
    birthYear: 1960,
    phone: "010-1234-0025",
    visits: [
      {
        visitDate: monthsAgo(10),
        procedures: [{ code: "U4453", name: "임플란트 fixture 식립", tooth: "14" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(9),
        procedures: [{ code: "U6052", name: "임플란트 보철", tooth: "14" }],
        diagnoses: [],
      },
    ],
  },

  // === 26~30: 사랑니 잠재 수요 ===
  {
    chartNumber: "CF-0026",
    name: "송지원",
    gender: "F",
    birthYear: 1998,
    phone: "010-1234-0026",
    visits: [
      {
        visitDate: monthsAgo(3),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }],
      },
    ],
  },
  {
    chartNumber: "CF-0027",
    name: "노현수",
    gender: "M",
    birthYear: 1996,
    phone: "010-1234-0027",
    visits: [
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }],
      },
    ],
  },
  {
    chartNumber: "CF-0028",
    name: "하은채",
    gender: "F",
    birthYear: 2000,
    phone: "010-1234-0028",
    visits: [
      {
        visitDate: monthsAgo(2),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [
          { code: "K010", name: "매복치", tooth: "18" },
          { code: "K018", name: "매복치 기타", tooth: "28" },
        ],
      },
    ],
  },
  {
    chartNumber: "CF-0029",
    name: "구본철",
    gender: "M",
    birthYear: 1994,
    phone: "010-1234-0029",
    visits: [
      {
        visitDate: monthsAgo(4),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K010", name: "매복치", tooth: "38" }],
      },
    ],
  },
  {
    chartNumber: "CF-0030",
    name: "피수연",
    gender: "F",
    birthYear: 1997,
    phone: "010-1234-0030",
    visits: [
      {
        visitDate: monthsAgo(1),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K011", name: "매복지치", tooth: "48" }],
      },
    ],
  },

  // === 31~35: 교정 잠재 수요 ===
  {
    chartNumber: "CF-0031",
    name: "양서준",
    gender: "M",
    birthYear: 2002,
    phone: "010-1234-0031",
    visits: [
      {
        visitDate: monthsAgo(5),
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [{ code: "K070", name: "악안면 이상" }],
      },
    ],
  },
  {
    chartNumber: "CF-0032",
    name: "도하영",
    gender: "F",
    birthYear: 2001,
    phone: "010-1234-0032",
    visits: [
      {
        visitDate: monthsAgo(3),
        procedures: [{ code: "ZZ002", name: "교정 검사" }],
        diagnoses: [{ code: "K071", name: "상하악 관계 이상" }],
      },
    ],
  },
  {
    chartNumber: "CF-0033",
    name: "원세훈",
    gender: "M",
    birthYear: 2003,
    phone: "010-1234-0033",
    visits: [
      {
        visitDate: monthsAgo(7),
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0034",
    name: "탁지민",
    gender: "F",
    birthYear: 1999,
    phone: "010-1234-0034",
    visits: [
      {
        visitDate: monthsAgo(2),
        procedures: [
          { code: "ZZ001", name: "교정 상담" },
          { code: "ZZ002", name: "교정 검사" },
        ],
        diagnoses: [{ code: "K073", name: "치아 위치 이상" }],
      },
    ],
  },
  {
    chartNumber: "CF-0035",
    name: "남수빈",
    gender: "F",
    birthYear: 2000,
    phone: "010-1234-0035",
    visits: [
      {
        visitDate: monthsAgo(4),
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [],
      },
    ],
  },

  // === 36~42: 일반 환자 (액션 불필요) ===
  {
    chartNumber: "CF-0036",
    name: "백은호",
    gender: "M",
    birthYear: 1986,
    phone: "010-1234-0036",
    visits: [
      {
        visitDate: daysAgo(7),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0037",
    name: "공다은",
    gender: "F",
    birthYear: 1991,
    phone: "010-1234-0037",
    visits: [
      {
        visitDate: daysAgo(3),
        procedures: [{ code: "U0001", name: "정기검진" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0038",
    name: "석진우",
    gender: "M",
    birthYear: 1979,
    phone: "010-1234-0038",
    visits: [
      {
        visitDate: daysAgo(14),
        procedures: [
          { code: "U4411", name: "발수(전치)", tooth: "22" },
          { code: "U4414", name: "근관충전(전치)", tooth: "22" },
        ],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "22" }],
      },
    ],
  },
  {
    chartNumber: "CF-0039",
    name: "주현아",
    gender: "F",
    birthYear: 1984,
    phone: "010-1234-0039",
    visits: [
      {
        visitDate: daysAgo(10),
        procedures: [
          { code: "U6010", name: "크라운 인상", tooth: "46" },
        ],
        diagnoses: [],
      },
      {
        visitDate: daysAgo(3),
        procedures: [
          { code: "U6030", name: "크라운 세팅", tooth: "46" },
        ],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0040",
    name: "방시혁",
    gender: "M",
    birthYear: 1972,
    phone: "010-1234-0040",
    isVip: true,
    visits: [
      {
        visitDate: daysAgo(5),
        procedures: [{ code: "U0001", name: "정기검진" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(3),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0041",
    name: "위지수",
    gender: "F",
    birthYear: 1995,
    phone: "010-1234-0041",
    visits: [
      {
        visitDate: daysAgo(1),
        procedures: [{ code: "U0001", name: "충전(레진)", tooth: "15" }],
        diagnoses: [{ code: "K029", name: "치아우식증", tooth: "15" }],
      },
    ],
  },
  {
    chartNumber: "CF-0042",
    name: "나현기",
    gender: "M",
    birthYear: 1967,
    phone: "010-1234-0042",
    visits: [
      {
        visitDate: daysAgo(2),
        procedures: [{ code: "U0001", name: "정기검진" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
    ],
  },

  // === 43~45: 복합 케이스 ===
  {
    chartNumber: "CF-0043",
    name: "민경호",
    gender: "M",
    birthYear: 1962,
    phone: "010-1234-0043",
    isVip: true,
    memo: "전체 치료 계획 진행 중",
    visits: [
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(5),
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(4),
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "47" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "47" }],
      },
      {
        visitDate: monthsAgo(18),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0044",
    name: "진소라",
    gender: "F",
    birthYear: 1985,
    phone: "010-1234-0044",
    visits: [
      {
        visitDate: monthsAgo(5),
        procedures: [{ code: "U1010", name: "치주소파술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
      {
        visitDate: monthsAgo(3),
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(14),
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
    ],
  },
  {
    chartNumber: "CF-0045",
    name: "채영수",
    gender: "M",
    birthYear: 1957,
    phone: "010-1234-0045",
    isVip: true,
    visits: [
      {
        visitDate: monthsAgo(8),
        procedures: [{ code: "U4452", name: "임플란트 fixture 식립", tooth: "25" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(7),
        procedures: [{ code: "U6051", name: "임플란트 보철", tooth: "25" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(2),
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }],
      },
      {
        visitDate: monthsAgo(20),
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
    ],
  },
];

const ruleConfigs = [
  {
    ruleType: "treatment_dropout",
    displayName: "치료 중단 탐지",
    description: "신경치료, 보철치료 중단 의심 환자를 탐지합니다.",
    enabled: true,
    parameters: JSON.stringify({
      nerve_treatment_days: 14,
      prosthetic_days: 21,
    }),
  },
  {
    ruleType: "scaling_recall",
    displayName: "스케일링/치주 리콜",
    description: "보험 스케일링 미수진자와 치주 정기 리콜 대상을 탐지합니다.",
    enabled: true,
    parameters: JSON.stringify({
      scaling_months: 12,
      perio_recall_months: 4,
    }),
  },
  {
    ruleType: "implant_followup",
    displayName: "임플란트 사후관리",
    description: "임플란트 시술 후 정기 점검 대상을 탐지합니다.",
    enabled: true,
    parameters: JSON.stringify({
      implant_checkup_months: [1, 3, 6, 12],
    }),
  },
  {
    ruleType: "potential_demand",
    displayName: "잠재 수요 발굴",
    description: "사랑니 발치, 교정 등 상담 후 미전환 잠재 수요를 탐지합니다.",
    enabled: true,
    parameters: JSON.stringify({}),
  },
];

async function main() {
  console.log("🌱 Seeding database...");

  // 기존 데이터 삭제
  await prisma.messageDraft.deleteMany();
  await prisma.recallRecommendation.deleteMany();
  await prisma.diagnosis.deleteMany();
  await prisma.procedure.deleteMany();
  await prisma.visit.deleteMany();
  await prisma.patient.deleteMany();
  await prisma.ruleConfig.deleteMany();

  // 환자 데이터 생성
  for (const p of patients) {
    const patient = await prisma.patient.create({
      data: {
        chartNumber: p.chartNumber,
        name: p.name,
        gender: p.gender,
        birthYear: p.birthYear,
        phone: p.phone,
        memo: p.memo || null,
        isVip: p.isVip || false,
      },
    });

    for (const v of p.visits) {
      await prisma.visit.create({
        data: {
          patientId: patient.id,
          visitDate: v.visitDate,
          memo: v.memo || null,
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
    }
  }

  // 규칙 설정 생성
  for (const rc of ruleConfigs) {
    await prisma.ruleConfig.create({ data: rc });
  }

  console.log(`✅ Seeded ${patients.length} patients and ${ruleConfigs.length} rule configs`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
