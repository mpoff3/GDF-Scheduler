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
