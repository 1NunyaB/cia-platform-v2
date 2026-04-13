import type { CaseRow } from "@/types";

export type CaseListFilters = {
  /** Matches title, description, accused, victims, weapon, city, state, year string. */
  q: string;
  accused: string;
  victim: string;
  state: string;
  weapon: string;
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
    weapon: g("weapon").trim(),
    year,
  };
}

export function hasActiveCaseFilters(f: CaseListFilters): boolean {
  return Boolean(
    f.q ||
      f.accused ||
      f.victim ||
      f.state ||
      f.weapon ||
      (f.year != null && Number.isFinite(f.year)),
  );
}

/**
 * Apply filters in-memory (user’s case set is typically small). Same predicates can move to SQL later.
 */
export function filterCasesByMetadata(cases: CaseRow[], f: CaseListFilters): CaseRow[] {
  let out = cases;

  if (f.year != null) {
    out = out.filter((c) => (c.incident_year as number | null | undefined) === f.year);
  }

  if (f.accused) {
    const t = f.accused.toLowerCase();
    out = out.filter((c) => (c.accused_label ?? "").toLowerCase().includes(t));
  }

  if (f.victim) {
    const t = f.victim.toLowerCase();
    out = out.filter((c) => (c.victim_labels ?? "").toLowerCase().includes(t));
  }

  if (f.state) {
    const t = f.state.toLowerCase();
    out = out.filter((c) => (c.incident_state ?? "").toLowerCase().includes(t));
  }

  if (f.weapon) {
    const t = f.weapon.toLowerCase();
    out = out.filter((c) => (c.known_weapon ?? "").toLowerCase().includes(t));
  }

  if (f.q) {
    const k = f.q.toLowerCase();
    out = out.filter((c) => {
      const blob = [
        c.title,
        c.description,
        c.accused_label,
        c.victim_labels,
        c.known_weapon,
        c.incident_city,
        c.incident_state,
        c.incident_year != null ? String(c.incident_year) : "",
      ]
        .map((x) => (x ?? "").toLowerCase())
        .join(" ");
      return blob.includes(k);
    });
  }

  return out;
}
