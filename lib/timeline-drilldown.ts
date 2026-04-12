/**
 * Calendar drill helpers for the case timeline workspace (year → month → week-of-month → day).
 */

export const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export type DrillSelection = {
  year: number | null;
  monthIndex: number | null;
  weekOfMonth: number | null;
  day: number | null;
};

export function parseEventDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 1-based week index within the calendar month (max 5). */
export function weekOfMonth(d: Date): number {
  return Math.floor((d.getDate() - 1) / 7) + 1;
}

export function uniqueYearsFromDates(dates: (Date | null)[]): number[] {
  const ys = new Set<number>();
  for (const d of dates) {
    if (d) ys.add(d.getFullYear());
  }
  return [...ys].sort((a, b) => a - b);
}

export function monthIndicesWithEventsInYear(dates: (Date | null)[], year: number): number[] {
  const ms = new Set<number>();
  for (const d of dates) {
    if (d && d.getFullYear() === year) ms.add(d.getMonth());
  }
  return [...ms].sort((a, b) => a - b);
}

export function weeksOfMonthWithEvents(dates: (Date | null)[], year: number, monthIndex: number): number[] {
  const ws = new Set<number>();
  for (const d of dates) {
    if (d && d.getFullYear() === year && d.getMonth() === monthIndex) {
      ws.add(weekOfMonth(d));
    }
  }
  return [...ws].sort((a, b) => a - b);
}

export function daysInSelection(
  dates: (Date | null)[],
  year: number,
  monthIndex: number,
  weekOfMonthN: number,
): number[] {
  const ds = new Set<number>();
  for (const d of dates) {
    if (!d) continue;
    if (d.getFullYear() !== year || d.getMonth() !== monthIndex) continue;
    if (weekOfMonth(d) !== weekOfMonthN) continue;
    ds.add(d.getDate());
  }
  return [...ds].sort((a, b) => a - b);
}

export function dateInDrillSelection(d: Date | null, sel: DrillSelection): boolean {
  if (!d) return false;
  if (sel.year != null && d.getFullYear() !== sel.year) return false;
  if (sel.monthIndex != null && d.getMonth() !== sel.monthIndex) return false;
  if (sel.weekOfMonth != null && weekOfMonth(d) !== sel.weekOfMonth) return false;
  if (sel.day != null && d.getDate() !== sel.day) return false;
  return true;
}

export function formatDrillBreadcrumb(sel: DrillSelection): string {
  const parts: string[] = [];
  if (sel.year != null) parts.push(String(sel.year));
  if (sel.monthIndex != null) parts.push(MONTH_NAMES[sel.monthIndex]);
  if (sel.weekOfMonth != null) parts.push(`Week ${sel.weekOfMonth}`);
  if (sel.day != null) parts.push(`Day ${sel.day}`);
  return parts.length ? parts.join(" → ") : "Years";
}
