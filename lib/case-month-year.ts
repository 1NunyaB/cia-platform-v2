/**
 * Light validation for MM/YYYY month-year strings used on cases (legal milestones: investigation opened, indictment, search warrant, etc.).
 * Accepts month 1–12 and a four-digit year; allows optional leading zero on month.
 */
const MM_YYYY = /^(0?[1-9]|1[0-2])\/(\d{4})$/;

export function isBlankOrValidMonthYear(value: string): boolean {
  const t = value.trim();
  if (!t) return true;
  return MM_YYYY.test(t);
}

export function monthYearErrorHint(value: string): string | null {
  if (!value.trim()) return null;
  return isBlankOrValidMonthYear(value) ? null : "Use month/year like 10/2021 (MM/YYYY).";
}

/** Split "M/YYYY" or "MM/YYYY" into parts for dropdowns. */
export function splitMonthYear(value: string): { month: string; year: string } {
  const t = value.trim();
  const m = t.match(/^(\d{1,2})\/(\d{4})$/);
  if (!m) return { month: "", year: "" };
  return { month: String(Number.parseInt(m[1], 10)), year: m[2] };
}

/** Build MM/YYYY from month (1–12) and year (4-digit) strings. */
export function joinMonthYear(month: string, year: string): string {
  if (!month.trim() || !year.trim()) return "";
  const mi = Number.parseInt(month, 10);
  const yi = Number.parseInt(year, 10);
  if (!Number.isFinite(mi) || mi < 1 || mi > 12 || !Number.isFinite(yi) || yi < 1800 || yi > 2100) return "";
  return `${mi}/${yi}`;
}

export const MONTH_SELECT_OPTIONS = Array.from({ length: 12 }, (_, i) => {
  const n = i + 1;
  return { value: String(n), label: String(n).padStart(2, "0") };
});

export const YEAR_SELECT_OPTIONS = (() => {
  const out: { value: string; label: string }[] = [];
  for (let y = 2035; y >= 1950; y--) {
    out.push({ value: String(y), label: String(y) });
  }
  return out;
})();
