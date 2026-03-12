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
  // ============================================================
  // KEY STORY 1: 신경치료 중단 — 바쁜 직장인 (데모 핵심 케이스)
  // 김민수(38세) — 발수까지 했으나 직장이 바빠 근관충전을 미루는 중
  // ============================================================
  {
    chartNumber: "CF-0001",
    name: "김민수",
    gender: "M",
    birthYear: 1985,
    phone: "010-1234-0001",
    memo: "IT기업 과장. 야근 잦아 예약 자주 취소. 통증 사라지면 안 옴",
    visits: [
      {
        visitDate: daysAgo(60),
        memo: "우측 하악 통증 주소",
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K029", name: "치아우식증", tooth: "46" }],
      },
      {
        visitDate: daysAgo(53),
        memo: "신경치료 시작, 통증 심함",
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "46" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "46" }],
      },
      {
        visitDate: daysAgo(46),
        memo: "근관성형 진행. 다음주 충전 예약",
        procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "46" }],
        diagnoses: [],
      },
      // 이후 미내원 — 약 46일 경과, 치료 중단 의심
    ],
  },

  // ============================================================
  // KEY STORY 2: 신경치료 중단 — 통증 사라져서 안 오는 환자
  // ============================================================
  {
    chartNumber: "CF-0002",
    name: "이영희",
    gender: "F",
    birthYear: 1990,
    phone: "010-1234-0002",
    memo: "통증 없어지면 치료 중단 이력 있음. 2022년에도 같은 패턴",
    visits: [
      {
        visitDate: daysAgo(20),
        memo: "좌측 하악 구치 통증",
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "36" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "36" }],
      },
      {
        visitDate: daysAgo(13),
        memo: "근관성형. 통증 많이 줄었다고 함",
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
    memo: "치과 공포증. 마취 관련 불안감 있음",
    visits: [
      {
        visitDate: daysAgo(40),
        memo: "치수괴사 확인, 발수 시행",
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

  // ============================================================
  // KEY STORY 3: VIP 신경치료 중단 — 고가치 환자 이탈 위험
  // 정태영(43세) — 가족 단위 VIP, 근관충전 안 함
  // ============================================================
  {
    chartNumber: "CF-0005",
    name: "정태영",
    gender: "M",
    birthYear: 1982,
    phone: "010-1234-0005",
    isVip: true,
    memo: "가족(4인) 모두 본원 환자. 매출 상위 5%. 연 3회 이상 내원 이력",
    visits: [
      {
        visitDate: monthsAgo(6),
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
      {
        visitDate: daysAgo(30),
        memo: "우측 상악 통증. 즉일 발수",
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "16" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "16" }],
      },
      {
        visitDate: daysAgo(23),
        memo: "근관성형 완료. 다음주 충전 예약했으나 미내원",
        procedures: [{ code: "U4412", name: "근관성형(구치)", tooth: "16" }],
        diagnoses: [],
      },
    ],
  },

  // ============================================================
  // KEY STORY 4: 보철 중단 — 인상 떠놓고 안 오는 환자들
  // ============================================================
  {
    chartNumber: "CF-0006",
    name: "한지은",
    gender: "F",
    birthYear: 1988,
    phone: "010-1234-0006",
    memo: "크라운 인상 후 비용 문제로 보류 중인 것으로 추정",
    visits: [
      {
        visitDate: daysAgo(45),
        memo: "우식 제거 + 크라운 prep",
        procedures: [
          { code: "U6020", name: "보철 prep", tooth: "26" },
        ],
        diagnoses: [{ code: "K029", name: "치아우식증", tooth: "26" }],
      },
      {
        visitDate: daysAgo(30),
        memo: "크라운 인상채득. 2주 후 세팅 예약",
        procedures: [{ code: "U6010", name: "크라운 인상", tooth: "26" }],
        diagnoses: [],
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
    memo: "사업가. 해외 출장 잦음. VIP 관리 필요",
    visits: [
      {
        visitDate: daysAgo(35),
        memo: "브릿지 인상. 출장 전에 세팅하겠다고 했으나 미내원",
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

  // ============================================================
  // KEY STORY 5: 스케일링 리콜 — 보험 스케일링 놓치는 장기 환자
  // 남궁석(60세) — 치주질환 이력 + 스케일링 미수진 + VIP
  // ============================================================
  {
    chartNumber: "CF-0011",
    name: "임재현",
    gender: "M",
    birthYear: 1970,
    phone: "010-1234-0011",
    memo: "매년 스케일링 안내 시 내원. 올해는 아직 미방문",
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
    memo: "만성치주염 10년차. 3~4개월 주기 관리 필수. 놓치면 급속 악화 우려",
    isVip: true,
    visits: [
      {
        visitDate: monthsAgo(16),
        memo: "연간 스케일링",
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(10),
        memo: "치주 정기점검 + 소파술",
        procedures: [{ code: "U1010", name: "치주소파술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
      {
        visitDate: monthsAgo(5),
        memo: "치근활택 시행. 다음 3개월 후 재내원 권고",
        procedures: [{ code: "U1020", name: "치근활택술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
      // 5개월 경과 → 치주 리콜 대상 + 스케일링 리콜 대상
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
    memo: "치주판막술 경험. 관리 순응도 높은 편이나 최근 미내원",
    visits: [
      {
        visitDate: monthsAgo(8),
        procedures: [{ code: "U1030", name: "치주판막술" }],
        diagnoses: [{ code: "K054", name: "치주증" }],
      },
      {
        visitDate: monthsAgo(6),
        memo: "판막술 후 경과 관찰",
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

  // ============================================================
  // KEY STORY 6: 임플란트 사후관리 — 고가 시술 후 점검 누락
  // 문정훈(62세) — 임플란트 보철 후 1개월 점검 안 함. VIP
  // ============================================================
  {
    chartNumber: "CF-0018",
    name: "문정훈",
    gender: "M",
    birthYear: 1963,
    phone: "010-1234-0018",
    isVip: true,
    memo: "임플란트 2개 식립 이력. 당뇨 관리 중. 임플란트 주위염 예방 중요",
    visits: [
      {
        visitDate: monthsAgo(8),
        memo: "임플란트 1차 수술 (#36)",
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }],
        diagnoses: [{ code: "K081", name: "사고로 인한 치아상실", tooth: "36" }],
      },
      {
        visitDate: monthsAgo(5),
        memo: "healing 확인, 2차 수술 진행",
        procedures: [{ code: "U4451", name: "임플란트 2차 수술", tooth: "36" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(2),
        memo: "최종 보철 세팅. 1개월 후 점검 예약",
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }],
        diagnoses: [],
      },
      // 2개월 경과 → 1개월 점검 누락
    ],
  },
  {
    chartNumber: "CF-0019",
    name: "유하나",
    gender: "F",
    birthYear: 1958,
    phone: "010-1234-0019",
    memo: "골다공증 약 복용 중 (비스포스포네이트 계열)",
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
    memo: "75세 고령. 전체 틀니에서 임플란트 전환. 관리 순응도 높음",
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

  // ============================================================
  // KEY STORY 7: 사랑니 잠재수요 — 젊은 환자, 전환 기회
  // 하은채(25세) — 양쪽 매복지치, 발치 필요하나 미결정
  // ============================================================
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
    memo: "양쪽 사랑니 매복. 군 입대 전 발치 고민 중이었으나 미결정",
    visits: [
      {
        visitDate: monthsAgo(2),
        memo: "양측 매복지치 확인. 파노라마 촬영. 발치 권유했으나 시기 고민 중",
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

  // ============================================================
  // KEY STORY 8: 교정 잠재수요 — 상담 후 미전환
  // 탁지민(26세) — 교정 상담 + 검사까지 했으나 시작 안 함
  // ============================================================
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
    memo: "교정 상담 + 세팔로/모델 분석까지 완료. 비용 상담 후 보류",
    visits: [
      {
        visitDate: monthsAgo(3),
        memo: "교정 초진 상담",
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [{ code: "K073", name: "치아 위치 이상" }],
      },
      {
        visitDate: monthsAgo(2),
        memo: "교정 정밀검사(세팔로, 모델). 비용 안내 후 생각해보겠다고 함",
        procedures: [{ code: "ZZ002", name: "교정 검사" }],
        diagnoses: [],
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

  // ============================================================
  // 일반 환자 (액션 불필요) — 정상 치료 완료 또는 최근 내원
  // ============================================================
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
    memo: "신경치료 + 근관충전 완료 (정상 종료 케이스)",
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
    memo: "크라운 인상 → 세팅 완료 (정상 종료 케이스)",
    visits: [
      {
        visitDate: daysAgo(10),
        procedures: [{ code: "U6010", name: "크라운 인상", tooth: "46" }],
        diagnoses: [],
      },
      {
        visitDate: daysAgo(3),
        procedures: [{ code: "U6030", name: "크라운 세팅", tooth: "46" }],
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

  // ============================================================
  // KEY STORY 9: 복합 케이스 — VIP, 임플란트+신경치료 중단+스케일링
  // 민경호(63세) — 전체 치료 계획 중 신경치료 중단 + 스케일링 리콜
  // ============================================================
  {
    chartNumber: "CF-0043",
    name: "민경호",
    gender: "M",
    birthYear: 1962,
    phone: "010-1234-0043",
    isVip: true,
    memo: "전체 치료 계획(임플+신경+스케일링) 진행 중. 고혈압 관리. 최고 우선 관리 대상",
    visits: [
      {
        visitDate: monthsAgo(18),
        memo: "연간 스케일링",
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(6),
        memo: "임플란트 식립 (#36)",
        procedures: [{ code: "U4451", name: "임플란트 fixture 식립", tooth: "36" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(5),
        memo: "임플란트 보철 완료 (#36)",
        procedures: [{ code: "U6050", name: "임플란트 보철", tooth: "36" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(4),
        memo: "반대측 47번 신경치료 시작. 다음 주 근관충전 예약",
        procedures: [{ code: "U4412", name: "발수(구치)", tooth: "47" }],
        diagnoses: [{ code: "K040", name: "치수염", tooth: "47" }],
      },
      // 4개월 경과 → 신경치료 중단 + 임플란트 6개월 점검 + 스케일링 리콜
    ],
  },

  // ============================================================
  // KEY STORY 10: 복합 케이스 — 치주+교정 상담+스케일링 리콜
  // 진소라(40세) — 치주관리 + 교정 상담 미전환 + 스케일링 시기
  // ============================================================
  {
    chartNumber: "CF-0044",
    name: "진소라",
    gender: "F",
    birthYear: 1985,
    phone: "010-1234-0044",
    memo: "치주 관리 중이면서 교정도 고민. 성인교정 비용 부담 언급",
    visits: [
      {
        visitDate: monthsAgo(14),
        memo: "스케일링 시행",
        procedures: [{ code: "U2230", name: "치석제거(1/3악)" }],
        diagnoses: [],
      },
      {
        visitDate: monthsAgo(5),
        memo: "치주소파술 시행",
        procedures: [{ code: "U1010", name: "치주소파술" }],
        diagnoses: [{ code: "K053", name: "만성치주염" }],
      },
      {
        visitDate: monthsAgo(3),
        memo: "교정 상담. 치주 안정 후 교정 가능하다고 안내",
        procedures: [{ code: "ZZ001", name: "교정 상담" }],
        diagnoses: [],
      },
      // 치주 리콜 + 교정 잠재수요 + 스케일링 리콜
    ],
  },

  // VIP 복합 — 임플란트+사랑니+스케일링
  {
    chartNumber: "CF-0045",
    name: "채영수",
    gender: "M",
    birthYear: 1957,
    phone: "010-1234-0045",
    isVip: true,
    memo: "장기 VIP. 임플란트 3개 이력. 정기관리 충실했으나 최근 미내원",
    visits: [
      {
        visitDate: monthsAgo(20),
        procedures: [{ code: "U2232", name: "치석제거(전악)" }],
        diagnoses: [],
      },
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
        memo: "정기검진 시 매복지치 발견",
        procedures: [{ code: "U0001", name: "검진" }],
        diagnoses: [{ code: "K010", name: "매복치", tooth: "18" }],
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

// ============================================================
// 담당자 mock 데이터
// ============================================================
const staffMembers = [
  { name: "김수진", role: "desk" },
  { name: "박미영", role: "counselor" },
  { name: "이원장", role: "doctor" },
  { name: "정관리", role: "manager" },
];

// 워크플로우 태스크 시드 설정
// chartNumber → 태스크 정보 매핑
interface TaskSeed {
  actionType: string;
  status: string;
  staffIndex: number; // staffMembers 인덱스 (-1이면 미지정)
  note: string | null;
  reason: string | null;
  nextFollowUpDays: number | null; // 오늘 기준 N일 후 (-N이면 N일 전)
}

const taskSeeds: Record<string, TaskSeed[]> = {
  // 김민수: 치료 중단 복귀 - 미처리 (데스크 담당)
  "CF-0001": [
    {
      actionType: "CHURN_REENGAGE",
      status: "unprocessed",
      staffIndex: 0,
      note: null,
      reason: null,
      nextFollowUpDays: null,
    },
  ],
  // 이영희: 치료 중단 - 검토 중
  "CF-0002": [
    {
      actionType: "CHURN_REENGAGE",
      status: "reviewing",
      staffIndex: 1,
      note: "통증 사라져서 안 올 가능성 높음, 전화 시도 예정",
      reason: null,
      nextFollowUpDays: 0, // 오늘 확인
    },
  ],
  // 박준호: 치료 중단 - 연락 대기
  "CF-0003": [
    {
      actionType: "CHURN_REENGAGE",
      status: "waiting_contact",
      staffIndex: 0,
      note: "전화 연결 안 됨, 오후 재시도 예정",
      reason: null,
      nextFollowUpDays: 0, // 오늘
    },
  ],
  // 정태영 VIP: 치료 중단 - 보류
  "CF-0005": [
    {
      actionType: "CHURN_REENGAGE",
      status: "on_hold",
      staffIndex: 1,
      note: "보호자와 상의 후 다음 주 확인 요청",
      reason: "VIP 환자 — 원장 직접 연락 필요",
      nextFollowUpDays: 3,
    },
  ],
  // 한지은: 보철 중단 - 미처리
  "CF-0006": [
    {
      actionType: "CHURN_REENGAGE",
      status: "unprocessed",
      staffIndex: -1,
      note: null,
      reason: null,
      nextFollowUpDays: null,
    },
  ],
  // 남궁석 VIP: 치주 리콜 - 재확인 예정
  "CF-0013": [
    {
      actionType: "PERIO_RECALL",
      status: "recheck_scheduled",
      staffIndex: 1,
      note: "치근활택 후 5개월 경과, 이번 주 내 연락 필요",
      reason: null,
      nextFollowUpDays: 1, // 내일
    },
    {
      actionType: "RECALL",
      status: "unprocessed",
      staffIndex: 0,
      note: null,
      reason: null,
      nextFollowUpDays: null,
    },
  ],
  // 문정훈 VIP: 임플란트 점검 - 완료
  "CF-0018": [
    {
      actionType: "IMPLANT_FOLLOWUP",
      status: "completed",
      staffIndex: 0,
      note: "카카오톡 발송 및 상담 완료",
      reason: "1개월 점검 안내 완료, 내원 약속 잡음",
      nextFollowUpDays: null,
    },
  ],
  // 류태완 VIP: 임플란트 점검 - 연락 대기
  "CF-0022": [
    {
      actionType: "IMPLANT_FOLLOWUP",
      status: "waiting_contact",
      staffIndex: 0,
      note: "3개월 점검 시기, 고령 환자 보호자 연락처로 시도 필요",
      reason: null,
      nextFollowUpDays: -1, // 기한 초과 (어제)
    },
  ],
  // 하은채: 메시지 발송 검토 - 제외
  "CF-0028": [
    {
      actionType: "MESSAGE_REVIEW",
      status: "excluded",
      staffIndex: 1,
      note: null,
      reason: "사랑니 발치 시기 미결정 — 본인이 연락하겠다고 함",
      nextFollowUpDays: null,
    },
  ],
  // 민경호 VIP: 복합 케이스 - 여러 태스크
  "CF-0043": [
    {
      actionType: "CHURN_REENGAGE",
      status: "reviewing",
      staffIndex: 2,
      note: "47번 신경치료 중단 4개월 경과, 원장 직접 연락 예정",
      reason: null,
      nextFollowUpDays: 2,
    },
    {
      actionType: "IMPLANT_FOLLOWUP",
      status: "unprocessed",
      staffIndex: -1,
      note: null,
      reason: null,
      nextFollowUpDays: null,
    },
    {
      actionType: "RECALL",
      status: "unprocessed",
      staffIndex: 0,
      note: null,
      reason: null,
      nextFollowUpDays: null,
    },
  ],
  // 진소라: 치주 리콜
  "CF-0044": [
    {
      actionType: "PERIO_RECALL",
      status: "waiting_contact",
      staffIndex: 1,
      note: "치주 안정 여부 확인 후 교정 재상담 권유 예정",
      reason: null,
      nextFollowUpDays: 5,
    },
  ],
  // 채영수 VIP: 리콜
  "CF-0045": [
    {
      actionType: "RECALL",
      status: "on_hold",
      staffIndex: 0,
      note: "장기 VIP 최근 미내원, 스케일링 시기 지남",
      reason: "진료 시작 여부 확인 필요",
      nextFollowUpDays: -2, // 기한 초과 (2일 전)
    },
  ],
};

async function main() {
  console.log("🌱 Seeding database...");

  // 기존 데이터 삭제 (FK 의존성 순서)
  await prisma.sourceNormalizationHistory.deleteMany();
  await prisma.importBatch.deleteMany();
  await prisma.syncJob.deleteMany();
  await prisma.user.deleteMany();
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

  // 환자 데이터 생성 (PII 분리 구조)
  for (const p of patients) {
    const patient = await prisma.patient.create({
      data: {
        chartNumber: p.chartNumber,
        gender: p.gender,
        birthYear: p.birthYear,
        tags: p.memo || null,
        isVip: p.isVip || false,
      },
    });

    // PII는 PatientIdentity에 분리 저장
    await prisma.patientIdentity.create({
      data: {
        patientId: patient.id,
        name: p.name,
        phone: p.phone,
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

  // 담당자 생성
  const createdStaff = [];
  for (const sm of staffMembers) {
    const s = await prisma.staff.create({ data: sm });
    createdStaff.push(s);
  }
  console.log(`✅ Seeded ${createdStaff.length} staff members`);

  // 환자 chartNumber → id 매핑
  const allPatients = await prisma.patient.findMany({ select: { id: true, chartNumber: true } });
  const chartToId: Record<string, string> = {};
  for (const p of allPatients) {
    chartToId[p.chartNumber] = p.id;
  }

  // 워크플로우 태스크 생성
  let taskCount = 0;
  for (const [chartNumber, tasks] of Object.entries(taskSeeds)) {
    const patientId = chartToId[chartNumber];
    if (!patientId) continue;

    for (const ts of tasks) {
      const assigneeId = ts.staffIndex >= 0 ? createdStaff[ts.staffIndex].id : null;
      const nextFollowUpAt = ts.nextFollowUpDays !== null
        ? (() => {
            const d = new Date();
            d.setDate(d.getDate() + ts.nextFollowUpDays);
            d.setHours(9, 0, 0, 0);
            return d;
          })()
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

      // 활동 로그 (생성 기록)
      await prisma.activityLog.create({
        data: {
          taskId: task.id,
          patientId,
          staffId: assigneeId,
          action: "task_created",
          toValue: ts.actionType,
          detail: JSON.stringify({ actionType: ts.actionType }),
        },
      });

      // 상태가 unprocessed가 아닌 경우 상태 변경 로그 추가
      if (ts.status !== "unprocessed") {
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            patientId,
            staffId: assigneeId,
            action: "status_change",
            fromValue: "unprocessed",
            toValue: ts.status,
          },
        });
      }

      // 메모가 있는 경우 메모 로그 추가
      if (ts.note) {
        await prisma.activityLog.create({
          data: {
            taskId: task.id,
            patientId,
            staffId: assigneeId,
            action: "note_added",
            toValue: ts.note.substring(0, 100),
          },
        });
      }

      taskCount++;
    }
  }

  console.log(`✅ Seeded ${taskCount} workflow tasks with activity logs`);
  console.log(`✅ Seeded ${patients.length} patients and ${ruleConfigs.length} rule configs`);
  console.log("   (PII separated into PatientIdentity table)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
