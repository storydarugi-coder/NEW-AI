/**
 * 개인정보 마스킹 유틸리티
 *
 * 데이터 최소화 원칙:
 * - 기본 UI에서 이름/전화번호/생년월일은 마스킹 표시
 * - 권한에 따라 원본 조회 가능 (향후 확장)
 * - LLM/외부 API 전송 시에도 마스킹된 값 사용
 */

/** 이름 마스킹: 김민수 → 김*수, 이영 → 이* */
export function maskName(name: string): string {
  if (!name) return "";
  if (name.length <= 1) return name;
  if (name.length === 2) return name[0] + "*";
  return name[0] + "*".repeat(name.length - 2) + name[name.length - 1];
}

/** 전화번호 마스킹: 010-1234-5678 → 010-****-5678 */
export function maskPhone(phone: string): string {
  if (!phone) return "";
  // 다양한 포맷 대응
  return phone.replace(/(\d{3})[-.\s]?(\d{4})[-.\s]?(\d{4})/, "$1-****-$3");
}

/** 생년 마스킹: 1985 → 1980년대 */
export function maskBirthYear(birthYear: number): string {
  const decade = Math.floor(birthYear / 10) * 10;
  return `${decade}년대`;
}

/** 차트번호 부분 마스킹: CF-0001 → CF-***1 */
export function maskChartNumber(chartNumber: string): string {
  if (!chartNumber || chartNumber.length < 4) return chartNumber;
  const prefix = chartNumber.slice(0, 3);
  const suffix = chartNumber.slice(-1);
  return prefix + "*".repeat(chartNumber.length - 4) + suffix;
}

/**
 * 마스킹 해제 권한 확인
 * 현재 데모에서는 항상 true 반환
 * 향후: 세션/역할 기반 권한 체크
 */
export function canViewPii(_userId?: string): boolean {
  // TODO: 실제 운영 시 역할 기반 권한 체크 구현
  // 예: admin, desk_staff → true / marketing → false
  return true;
}

/**
 * 환자 식별정보를 마스킹 여부에 따라 반환
 */
export function formatPatientName(
  name: string,
  masked: boolean = false
): string {
  return masked ? maskName(name) : name;
}

export function formatPatientPhone(
  phone: string,
  masked: boolean = false
): string {
  return masked ? maskPhone(phone) : phone;
}

/**
 * LLM/메시지 생성 시 최소 컨텍스트만 전달하기 위한 정제
 * 차트 원문, 자유서술 메모 등은 제외하고 정형 신호만 포함
 */
export function sanitizeForLLM(input: {
  patientName: string;
  detection: { reason: string; subType: string };
  recentVisitDate?: string;
}): {
  patientName: string;
  reason: string;
  subType: string;
  recentVisitDate?: string;
} {
  return {
    // 이름만 전달 (성+*로 마스킹된 값)
    patientName: maskName(input.patientName),
    reason: input.detection.reason,
    subType: input.detection.subType,
    recentVisitDate: input.recentVisitDate,
  };
}
