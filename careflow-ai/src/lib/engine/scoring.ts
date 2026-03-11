/**
 * 우선순위 점수 산정 로직
 *
 * explainable: 각 점수 항목의 근거를 함께 반환합니다.
 */

import { DetectionResult } from "@/types";

export interface ScoreBreakdown {
  totalScore: number;
  factors: {
    label: string;
    score: number;
    reason: string;
  }[];
}

export function calculatePriorityScore(
  detections: DetectionResult[],
  lastVisitDate: Date | null,
  isVip: boolean,
  visitCount: number
): ScoreBreakdown {
  const factors: ScoreBreakdown["factors"] = [];

  // 1. 탐지 심각도 점수 (최대 40점)
  let severityScore = 0;
  for (const d of detections) {
    const priorityWeight = { 1: 15, 2: 10, 3: 5, 4: 2 };
    severityScore += priorityWeight[d.priority as keyof typeof priorityWeight] || 3;
  }
  severityScore = Math.min(severityScore, 40);
  if (severityScore > 0) {
    factors.push({
      label: "탐지 심각도",
      score: severityScore,
      reason: `${detections.length}건 탐지 (긴급 ${detections.filter((d) => d.priority === 1).length}건)`,
    });
  }

  // 2. 미방문 기간 점수 (최대 25점)
  let visitGapScore = 0;
  if (lastVisitDate) {
    const daysSince = Math.floor(
      (Date.now() - lastVisitDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (daysSince > 180) visitGapScore = 25;
    else if (daysSince > 90) visitGapScore = 15;
    else if (daysSince > 30) visitGapScore = 8;
    else visitGapScore = 2;

    factors.push({
      label: "미방문 기간",
      score: visitGapScore,
      reason: `마지막 방문 ${daysSince}일 전`,
    });
  }

  // 3. 치료 중단 가중 (최대 20점)
  const hasDropout = detections.some((d) => d.ruleType === "treatment_dropout");
  if (hasDropout) {
    factors.push({
      label: "치료 중단 위험",
      score: 20,
      reason: "진행 중인 치료가 중단된 상태",
    });
  }

  // 4. VIP 가중 (10점)
  if (isVip) {
    factors.push({
      label: "VIP 환자",
      score: 10,
      reason: "VIP 지정 환자",
    });
  }

  // 5. 방문 빈도 가중 (최대 5점)
  if (visitCount >= 5) {
    factors.push({
      label: "단골 환자",
      score: 5,
      reason: `총 ${visitCount}회 방문 (단골 환자 관리 필요)`,
    });
  }

  const totalScore = factors.reduce((sum, f) => sum + f.score, 0);

  return { totalScore, factors };
}

/**
 * mock 전주 대비 변화 계산 (실제 운영에서는 날짜 기반 비교)
 */
export function calculateWeeklyChange(currentCount: number): {
  change: number;
  label: string;
} {
  // V1에서는 결정적(deterministic) mock 계산
  // 현재 수치 기반으로 약간의 변동을 시뮬레이션
  const seed = currentCount * 7 + 3;
  const change = (seed % 5) - 2; // -2 ~ +2 범위
  const prefix = change > 0 ? "+" : "";
  return {
    change,
    label: `전주 대비 ${prefix}${change}`,
  };
}
