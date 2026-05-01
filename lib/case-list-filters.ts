import {
  caseDirectorySearchBlob,
  legacyArraysFromPeople,
  parseCaseIncidents,
  resolvedCasePeople,
} from "@/lib/case-directory";
import type { CaseRow } from "@/types";

export type CaseListFilters = {
  /** Matches title, description, accused, victims, charges, city, state, year string. */
  q: string;
  accused: string;
  victim: string;
  state: string;
  charges: string;
  /** Exact calendar year when set */
  year: number | null;
};

export function parseCaseListFilters(
  sp: Record<string, string | string[] | undefined>,
): CaseListFilters {
  const g = (k: string) => {
    const v = sp[k];
    if (Array.isArray(v)) return v[0] ?? "";
    return typeof v === "string" ? v : "";
  };
  const yearRaw = g("year").trim();
  let year: number | null = null;
  if (yearRaw) {
    const n = Number.parseInt(yearRaw, 10);
    if (Number.isFinite(n) && n >= 1000 && n <= 9999) year = n;
  }
  return {
    q: g("q").trim(),
    accused: g("accused").trim(),
    victim: g("victim").trim(),
    state: g("state").trim(),
    charges: g("charges").trim() || g("weapon").trim(),
    year,
  };
}

export function hasActiveCaseFilters(f: CaseListFilters): boolean {
  return Boolean(
    f.q ||
      f.accused ||
      f.victim ||
      f.state ||
      f.charges ||
      (f.year != null && Number.isFinite(f.year)),
  );
}

/**
 * Apply filters in-memory (user’s case set is typically small). Same predicates can move to SQL later.
 */
export function filterCasesByMetadata(cases: CaseRow[], f: CaseListFilters): CaseRow[] {
  let out = cases;

  if (f.year != null) {
    out = out.filter((c) => {
      if ((c.incident_year as number | null | undefined) === f.year) return true;
      return parseCaseIncidents((c as { incidents?: unknown }).incidents).some((i) => i.year === f.year);
    });
  }

  if (f.accused) {
    const t = f.accused.toLowerCase();
    out = out.filter((c) => {
      if ((c.accused_label ?? "").toLowerCase().includes(t)) return true;
      const { case_accused } = legacyArraysFromPeople(resolvedCasePeople(c));
      return case_accused.some((a) => a.toLowerCase().includes(t));
    });
  }

  if (f.victim) {
    const t = f.victim.toLowerCase();
    out = out.filter((c) => {
      if ((c.victim_labels ?? "").toLowerCase().includes(t)) return true;
      const { case_victims } = legacyArraysFromPeople(resolvedCasePeople(c));
      return case_victims.some((v) => v.toLowerCase().includes(t));
    });
  }

  if (f.state) {
    const t = f.state.toLowerCase();
    out = out.filter((c) => {
      if ((c.incident_state ?? "").toLowerCase().includes(t)) return true;
      return parseCaseIncidents((c as { incidents?: unknown }).incidents).some((i) =>
        (i.state ?? "").toLowerCase().includes(t),
      );
    });
  }

  if (f.charges) {
    const t = f.charges.toLowerCase();
    out = out.filter((c) => (c.charges ?? "").toLowerCase().includes(t));
  }

  if (f.q) {
    const k = f.q.toLowerCase();
    out = out.filter((c) => caseDirectorySearchBlob(c).includes(k));
  }

  return out;
}
