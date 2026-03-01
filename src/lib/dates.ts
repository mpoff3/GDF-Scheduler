export function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getUTCDay();
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function addWeeks(date: Date, weeks: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + weeks * 7);
  return d;
}

export function weeksBetween(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  return Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));
}

export function generateWeekStarts(start: Date, count: number): Date[] {
  const monday = getMonday(start);
  return Array.from({ length: count }, (_, i) => addWeeks(monday, i));
}

export function formatWeekDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function toDateString(date: Date): string {
  return date.toISOString().split("T")[0];
}

export function fromDateString(dateStr: string): Date {
  const d = new Date(dateStr + "T00:00:00.000Z");
  return d;
}

export type FiscalYearKey =
  | "default"
  | "fy24_25"
  | "fy25_26"
  | "fy26_27"
  | "fy27_28"
  | "fy28_29"
  | "fy29_30";

export type FiscalYearOption = {
  value: FiscalYearKey;
  label: string;
  startYear?: number;
};

export const FISCAL_YEAR_OPTIONS: FiscalYearOption[] = [
  { value: "default", label: "Default" },
  { value: "fy24_25", label: "FY 24/25", startYear: 2024 },
  { value: "fy25_26", label: "FY 25/26", startYear: 2025 },
  { value: "fy26_27", label: "FY 26/27", startYear: 2026 },
  { value: "fy27_28", label: "FY 27/28", startYear: 2027 },
  { value: "fy28_29", label: "FY 28/29", startYear: 2028 },
  { value: "fy29_30", label: "FY 29/30", startYear: 2029 },
];

export function getFirstMondayOfJuly(year: number): Date {
  const julyFirst = new Date(Date.UTC(year, 6, 1));
  const day = julyFirst.getUTCDay();
  const offsetDays = day === 0 ? 1 : day === 1 ? 0 : 8 - day;
  julyFirst.setUTCDate(julyFirst.getUTCDate() + offsetDays);
  julyFirst.setUTCHours(0, 0, 0, 0);
  return julyFirst;
}

export function getLastMondayOfJune(year: number): Date {
  const juneLast = new Date(Date.UTC(year, 5, 30));
  const day = juneLast.getUTCDay();
  const offsetBack = day === 0 ? 6 : day - 1;
  juneLast.setUTCDate(juneLast.getUTCDate() - offsetBack);
  juneLast.setUTCHours(0, 0, 0, 0);
  return juneLast;
}

export function getFiscalYearWindow(startYear: number): {
  start: Date;
  end: Date;
  weekCount: number;
} {
  const start = getFirstMondayOfJuly(startYear);
  const end = getLastMondayOfJune(startYear + 1);
  const weekCount = weeksBetween(start, end) + 1;
  return { start, end, weekCount };
}
