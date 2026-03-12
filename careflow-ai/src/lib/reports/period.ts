/**
 * 리포트 기간 필터 유틸리티
 * 지원 기간: today, week, month, 30days, custom
 */

export type PeriodType = "today" | "week" | "month" | "30days" | "custom";

export interface DateRange {
  from: Date;
  to: Date;
}

export function parsePeriod(
  period?: string | null,
  customFrom?: string | null,
  customTo?: string | null
): DateRange {
  const now = new Date();
  const to = new Date(now);
  to.setHours(23, 59, 59, 999);

  switch (period) {
    case "today": {
      const from = new Date(now);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "week": {
      const from = new Date(now);
      from.setDate(from.getDate() - from.getDay()); // Sunday start
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "custom": {
      if (customFrom && customTo) {
        return {
          from: new Date(customFrom + "T00:00:00"),
          to: new Date(customTo + "T23:59:59.999"),
        };
      }
      // fallback to 30days
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "30days":
    default: {
      const from = new Date(now);
      from.setDate(from.getDate() - 30);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
  }
}

export function periodLabel(period: string): string {
  const labels: Record<string, string> = {
    today: "오늘",
    week: "이번 주",
    month: "이번 달",
    "30days": "최근 30일",
    custom: "사용자 지정",
  };
  return labels[period] || "최근 30일";
}
