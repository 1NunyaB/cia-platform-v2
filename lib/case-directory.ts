import type { CaseRow } from "@/types";
import { isBlankOrValidMonthYear } from "@/lib/case-month-year";
import { z } from "zod";

/** One incident row in flattened `incidents` JSON (legacy + derived storage). */
export type CaseIncident = {
  description: string;
  date?: string | null;
  city?: string;
  state?: string;
  address_line_1?: string;
  address_line_2?: string;
  year?: number | null;
};

/** Stored `type` is a display label (title case); legacy JSON may still use snake_case slugs. */
export type LegalMilestoneType = string;

/** Default legal actions (seeded in `legal_action_labels` + canonicalization). */
export const DEFAULT_LEGAL_ACTION_LABELS = [
  "Investigation Opened",
  "Indictment",
  "Conviction",
  "Acquittal",
  "Dismissal",
  "Search Warrant",
  "Deal Made",
] as const;

/** Legacy JSON slug → display label (incident_entries / case legal_milestones). */
const LEGAL_MILESTONE_SLUG_TO_LABEL: Record<string, string> = {
  investigation_opened: "Investigation Opened",
  indictment: "Indictment",
  search_warrant: "Search Warrant",
  conviction: "Conviction",
  acquittal: "Acquittal",
  dismissal: "Dismissal",
};

/** @deprecated Use DEFAULT_LEGAL_ACTION_LABELS; kept for older imports. */
export const LEGAL_MILESTONE_TYPES: LegalMilestoneType[] = [
  ...DEFAULT_LEGAL_ACTION_LABELS,
];

/** @deprecated Slug→label map removed from storage; map is internal only — use canonicalizeLegalActionLabel. */
export const LEGAL_MILESTONE_LABELS: Record<string, string> = { ...LEGAL_MILESTONE_SLUG_TO_LABEL };

/** Compact labels for one-line case summaries (keys = canonical display labels). */
export const LEGAL_MILESTONE_ABBREV: Record<string, string> = {
  "Investigation Opened": "Inv. open.",
  Indictment: "Indict.",
  "Search Warrant": "Warrant",
  Conviction: "Conv.",
  Acquittal: "Acquit.",
  Dismissal: "Dismiss.",
  "Deal Made": "Deal",
};

export type CaseLegalMilestone = {
  type: string;
  month_year: string;
  sentence_detail?: string | null;
};

/** Normalize legacy slugs and case variants to canonical default spellings; preserve unknown custom labels. */
export function canonicalizeLegalActionLabel(type: string): string {
  const t = type.trim();
  if (!t) return DEFAULT_LEGAL_ACTION_LABELS[0];
  if (LEGAL_MILESTONE_SLUG_TO_LABEL[t]) return LEGAL_MILESTONE_SLUG_TO_LABEL[t];
  const norm = t.toLowerCase().replace(/\s+/g, " ");
  for (const label of DEFAULT_LEGAL_ACTION_LABELS) {
    if (label.toLowerCase() === norm) return label;
  }
  for (const [slug, label] of Object.entries(LEGAL_MILESTONE_SLUG_TO_LABEL)) {
    if (slug.replace(/_/g, " ") === norm || slug === norm) return label;
  }
  return t;
}

export function legalActionIsConviction(action: string): boolean {
  return canonicalizeLegalActionLabel(action) === "Conviction";
}

export function legalActionIsIndictment(action: string): boolean {
  return canonicalizeLegalActionLabel(action) === "Indictment";
}

/** Short label for list UI (known defaults + sensible fallback for custom actions). */
export function abbrevLegalMilestoneAction(label: string): string {
  const c = canonicalizeLegalActionLabel(label);
  return LEGAL_MILESTONE_ABBREV[c] ?? (c.length > 24 ? `${c.slice(0, 21)}…` : c);
}

export type CasePerson = {
  name: string;
  role: string;
};

/** Investigation role labels seeded in DB + used for legacy alias normalization. */
export const PERSON_ROLE_OPTIONS = [
  "Victim/Accuser",
  "Accused",
  "Employee",
  "FBI Investigator",
  "Officer",
  "Witness",
  "Government Official",
  "Police Officer",
] as const;

/**
 * Map legacy stored roles to current labels. Old separate Victim / Accuser → Victim/Accuser.
 * Known presets normalize to canonical spelling; other text is preserved for custom reusable roles.
 */
export function canonicalizePersonRole(role: string): string {
  const t = role.trim();
  if (!t) return "Victim/Accuser";
  const norm = t.toLowerCase().replace(/\s+/g, " ");
  if (norm === "victim" || norm === "victims" || norm === "accuser") return "Victim/Accuser";
  for (const opt of PERSON_ROLE_OPTIONS) {
    if (opt.toLowerCase() === norm) return opt;
  }
  return t;
}

/**
 * One evidence row for an incident: at most one file attachment per row, plus optional reference text.
 * An incident’s `evidence_items` array may contain many entries; each is independent (add rows for multiple files).
 */
export type CaseEvidenceFileEntry = {
  /** Stable client id for this row (not necessarily the uploaded evidence id). */
  id: string;
  label: string;
  file_reference?: string | null;
  notes?: string | null;
  /** Populated when a real file was uploaded for this row (case evidence id). */
  evidence_id?: string | null;
};

export type CaseEvidenceItem = CaseEvidenceFileEntry;

const personSchema = z.object({
  name: z.string().max(500),
  role: z.string().max(200),
});

const legalMilestoneSchema = z.object({
  type: z.string().max(200),
  month_year: z.string().max(16),
  sentence_detail: z.string().max(8000).nullable().optional(),
});

const evidenceItemSchema = z.object({
  id: z.string().max(80),
  label: z.string().max(500),
  file_reference: z.string().max(500).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  evidence_id: z.string().max(80).nullable().optional(),
});

const incidentEntrySchema = z.object({
  id: z.string().max(80),
  incident_title: z.string().max(500),
  description: z.string().max(8000),
  date: z.string().max(32).nullable().optional(),
  city: z.string().max(200).optional(),
  state: z.string().max(100).optional(),
  address_line_1: z.string().max(500).optional().default(""),
  address_line_2: z.string().max(500).optional().default(""),
  year: z.number().int().min(1800).max(2100).nullable().optional(),
  people: z.array(personSchema).max(80),
  charges: z.string().max(8000),
  legal_milestones: z.array(legalMilestoneSchema).max(40),
  /** Repeatable list: one file (or reference-only row) per entry; same incident may have many. */
  evidence_items: z.array(evidenceItemSchema).max(80),
});

export type CaseIncidentEntry = z.infer<typeof incidentEntrySchema>;

export const caseDirectoryPayloadSchema = z.object({
  incident_entries: z.array(incidentEntrySchema).max(40),
});

export type CaseDirectoryPayload = z.infer<typeof caseDirectoryPayloadSchema>;

export function newIncidentEntryId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `ie_${Math.random().toString(36).slice(2, 12)}_${Date.now()}`;
}

export function emptyIncidentEntry(): CaseIncidentEntry {
  return {
    id: newIncidentEntryId(),
    incident_title: "",
    description: "",
    date: null,
    city: "",
    state: "",
    address_line_1: "",
    address_line_2: "",
    year: null,
    people: [],
    charges: "",
    legal_milestones: [],
    evidence_items: [],
  };
}

export function emptyCaseDirectory(): CaseDirectoryPayload {
  return { incident_entries: [] };
}

/** Merge one incident into the list when adding or editing from the incident dialog (stable row ids). */
export function mergeIncidentIntoList(
  incident_entries: CaseIncidentEntry[],
  entry: CaseIncidentEntry,
  editingIndex: number | null,
): CaseIncidentEntry[] {
  const list = [...incident_entries];
  if (editingIndex != null && editingIndex >= 0 && editingIndex < list.length) {
    list[editingIndex] = entry;
    return list;
  }
  // In add mode, append by default, but if this id already exists (e.g. dialog re-save/upload path),
  // replace that specific row instead of collapsing the full array through a Map.
  const byIdIndex = list.findIndex((x) => x.id === entry.id);
  if (byIdIndex >= 0) {
    list[byIdIndex] = entry;
    return list;
  }
  return [...list, entry];
}

/** Flatten grouped entries for legacy `incidents`, `case_people`, global JSON columns, and search. */
export type FlattenedCaseDirectory = {
  incidents: CaseIncident[];
  people: CasePerson[];
  legal_milestones: CaseLegalMilestone[];
  evidence_file_entries: CaseEvidenceFileEntry[];
  charges: string;
};

export function flattenIncidentEntries(entries: CaseIncidentEntry[]): FlattenedCaseDirectory {
  const incidents: CaseIncident[] = [];
  const people: CasePerson[] = [];
  const legal_milestones: CaseLegalMilestone[] = [];
  const evidence_file_entries: CaseEvidenceFileEntry[] = [];
  const chargeParts: string[] = [];

  for (const e of entries) {
    const titlePart = e.incident_title?.trim() ?? "";
    const descPart = e.description?.trim() ?? "";
    const description = [titlePart, descPart].filter(Boolean).join(" — ") || descPart || titlePart;

    incidents.push({
      description,
      date: e.date?.trim() ? e.date.trim() : null,
      city: e.city?.trim() ?? "",
      state: e.state?.trim() ?? "",
      address_line_1: e.address_line_1?.trim() ?? "",
      address_line_2: e.address_line_2?.trim() ?? "",
      year: e.year ?? null,
    });
    people.push(...e.people);
    legal_milestones.push(...e.legal_milestones);
    evidence_file_entries.push(...e.evidence_items);
    const ch = e.charges?.trim();
    if (ch) chargeParts.push(ch);
  }

  return {
    incidents,
    people,
    legal_milestones,
    evidence_file_entries,
    charges: chargeParts.join("\n\n---\n\n"),
  };
}

/** Split people into legacy string arrays for `case_victims` / `case_accused` columns. */
export function legacyArraysFromPeople(people: CasePerson[]): { case_victims: string[]; case_accused: string[] } {
  const case_victims: string[] = [];
  const case_accused: string[] = [];
  for (const p of people) {
    const n = p.name.trim();
    if (!n) continue;
    const role = canonicalizePersonRole(p.role);
    if (role === "Victim/Accuser") case_victims.push(n);
    else if (role === "Accused") case_accused.push(n);
  }
  return { case_victims, case_accused };
}

function normalizeLegalMilestone(m: CaseLegalMilestone): CaseLegalMilestone {
  const type = canonicalizeLegalActionLabel(typeof m.type === "string" ? m.type : "");
  return {
    type,
    month_year: m.month_year.trim(),
    sentence_detail:
      legalActionIsConviction(type) && m.sentence_detail?.trim() ? m.sentence_detail.trim() : null,
  };
}

function normalizeEvidenceItem(e: CaseEvidenceFileEntry): CaseEvidenceFileEntry {
  const evidence_id = e.evidence_id?.trim() || null;
  return {
    ...e,
    evidence_id,
    label: e.label.trim(),
    file_reference: e.file_reference?.trim() || null,
    notes: e.notes?.trim() || null,
  };
}

/** Reference-only rows, uploaded rows, or anything the user typed counts as content. */
export function incidentEvidenceRowHasContent(ev: CaseEvidenceFileEntry): boolean {
  return Boolean(
    ev.label.trim() ||
      (ev.evidence_id?.trim() ?? "").length > 0 ||
      (ev.file_reference?.trim() ?? "").length > 0 ||
      (ev.notes?.trim() ?? "").length > 0,
  );
}

export function stripEmptyEvidenceItems(items: CaseEvidenceFileEntry[]): CaseEvidenceFileEntry[] {
  return items.filter(incidentEvidenceRowHasContent);
}

function normalizeIncidentEntry(e: CaseIncidentEntry): CaseIncidentEntry {
  const people = e.people
    .map((x) => {
      const name = x.name.trim();
      if (!name.length) return null;
      const roleRaw = x.role.trim();
      return {
        name,
        role: roleRaw ? canonicalizePersonRole(roleRaw) : "Victim/Accuser",
      };
    })
    .filter((x): x is CasePerson => x !== null);

  const legal_milestones = e.legal_milestones
    .map(normalizeLegalMilestone)
    .filter((m) => m.month_year && isBlankOrValidMonthYear(m.month_year));

  const evidence_items = e.evidence_items.map(normalizeEvidenceItem).filter(incidentEvidenceRowHasContent);

  return {
    ...e,
    id: e.id?.trim() || newIncidentEntryId(),
    incident_title: e.incident_title?.trim() ?? "",
    description: e.description?.trim() ?? "",
    date: e.date?.trim() ? e.date.trim() : null,
    city: e.city?.trim() ?? "",
    state: e.state?.trim() ?? "",
    address_line_1: e.address_line_1?.trim() ?? "",
    address_line_2: e.address_line_2?.trim() ?? "",
    year: e.year ?? null,
    people,
    charges: e.charges.trim() ? e.charges.trim() : "",
    legal_milestones,
    evidence_items,
  };
}

function entryIsMeaningful(e: CaseIncidentEntry): boolean {
  if (e.incident_title.trim()) return true;
  if (e.description.trim()) return true;
  if (e.date) return true;
  if ((e.city?.trim() ?? "") || (e.state?.trim() ?? "")) return true;
  if ((e.address_line_1?.trim() ?? "") || (e.address_line_2?.trim() ?? "")) return true;
  if (e.year != null) return true;
  if (e.people.some((p) => p.name.trim())) return true;
  if (e.charges.trim()) return true;
  if (e.legal_milestones.length) return true;
  if (e.evidence_items.some(incidentEvidenceRowHasContent)) return true;
  return false;
}

export function normalizeCaseDirectoryPayload(p: CaseDirectoryPayload): CaseDirectoryPayload {
  const incident_entries = p.incident_entries.map(normalizeIncidentEntry).filter(entryIsMeaningful);
  return { incident_entries };
}

export function deriveLegacyFromDirectory(d: CaseDirectoryPayload): {
  incident_city: string | null;
  incident_state: string | null;
  incident_year: number | null;
  victim_labels: string | null;
  accused_label: string | null;
  indictment_month_year: string | null;
  conviction_month_year: string | null;
  sentence: string | null;
} {
  return deriveLegacyFromFlattened(flattenIncidentEntries(d.incident_entries));
}

function yearFromIsoDate(iso: string | null | undefined): number | null {
  if (!iso?.trim()) return null;
  const m = iso.trim().match(/^(\d{4})-\d{2}-\d{2}/);
  if (!m) return null;
  const y = Number.parseInt(m[1], 10);
  return Number.isFinite(y) ? y : null;
}

export function deriveLegacyFromFlattened(flat: FlattenedCaseDirectory): {
  incident_city: string | null;
  incident_state: string | null;
  incident_year: number | null;
  victim_labels: string | null;
  accused_label: string | null;
  indictment_month_year: string | null;
  conviction_month_year: string | null;
  sentence: string | null;
} {
  const { case_victims, case_accused } = legacyArraysFromPeople(flat.people);
  const firstLoc = flat.incidents.find((i) => i.city?.trim() || i.state?.trim());
  const first = flat.incidents[0];
  const yearFromDate = first ? yearFromIsoDate(first.date) : null;
  const incident_year = yearFromDate ?? first?.year ?? null;

  const firstIndict = flat.legal_milestones.find((m) => legalActionIsIndictment(m.type));
  const firstConv = flat.legal_milestones.find((m) => legalActionIsConviction(m.type));
  return {
    incident_city: firstLoc?.city?.trim() ? firstLoc.city.trim() : null,
    incident_state: firstLoc?.state?.trim() ? firstLoc.state.trim() : null,
    incident_year,
    victim_labels: case_victims.length ? case_victims.join(", ") : null,
    accused_label: case_accused[0] ?? null,
    indictment_month_year: firstIndict?.month_year?.trim() || null,
    conviction_month_year: firstConv?.month_year?.trim() || null,
    sentence: firstConv?.sentence_detail?.trim() || null,
  };
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

export function parseCaseIncidents(raw: unknown): CaseIncident[] {
  if (!Array.isArray(raw)) return [];
  const out: CaseIncident[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const hasDesc = typeof item.description === "string";
    if (hasDesc) {
      const date = typeof item.date === "string" && item.date.trim() ? item.date.trim() : null;
      const city = typeof item.city === "string" ? item.city : "";
      const state = typeof item.state === "string" ? item.state : "";
      const address_line_1 = typeof item.address_line_1 === "string" ? item.address_line_1 : "";
      const address_line_2 = typeof item.address_line_2 === "string" ? item.address_line_2 : "";
      let year: number | null = null;
      if (typeof item.year === "number" && Number.isFinite(item.year)) year = item.year;
      out.push({
        description: item.description as string,
        date,
        city,
        state,
        address_line_1,
        address_line_2,
        year,
      });
      continue;
    }
    const city = typeof item.city === "string" ? item.city : "";
    const state = typeof item.state === "string" ? item.state : "";
    const address_line_1 = typeof item.address_line_1 === "string" ? item.address_line_1 : "";
    const address_line_2 = typeof item.address_line_2 === "string" ? item.address_line_2 : "";
    let year: number | null = null;
    if (typeof item.year === "number" && Number.isFinite(item.year)) year = item.year;
    if (!city.trim() && !state.trim() && !address_line_1.trim() && !address_line_2.trim() && year == null) continue;
    const addr = [address_line_1, address_line_2].filter(Boolean).join(", ");
    const loc = [addr, city, state].filter(Boolean).join(", ");
    const description = loc
      ? year != null
        ? `Location: ${loc} (${year})`
        : `Location: ${loc}`
      : year != null
        ? `Incident (${year})`
        : "Incident";
    out.push({ description, date: null, city, state, address_line_1, address_line_2, year });
  }
  return out;
}

export function parseStringArray(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((x): x is string => typeof x === "string").map((s) => s);
}

export function parseCasePeople(raw: unknown): CasePerson[] {
  if (!Array.isArray(raw)) return [];
  const out: CasePerson[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const name = typeof item.name === "string" ? item.name : "";
    const role = typeof item.role === "string" ? item.role : "";
    if (!name.trim()) continue;
    out.push({
      name: name.trim(),
      role: role.trim() ? canonicalizePersonRole(role.trim()) : "Victim/Accuser",
    });
  }
  return out;
}

export function parseLegalMilestones(raw: unknown): CaseLegalMilestone[] {
  if (!Array.isArray(raw)) return [];
  const out: CaseLegalMilestone[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const rawType = item.type;
    if (typeof rawType !== "string" || !rawType.trim()) continue;
    const type = canonicalizeLegalActionLabel(rawType);
    const month_year = typeof item.month_year === "string" ? item.month_year.trim() : "";
    if (!month_year) continue;
    const sentence_detail =
      typeof item.sentence_detail === "string" && item.sentence_detail.trim()
        ? item.sentence_detail.trim()
        : null;
    out.push({
      type,
      month_year,
      sentence_detail: legalActionIsConviction(type) ? sentence_detail : null,
    });
  }
  return out;
}

export function parseEvidenceFileEntries(raw: unknown): CaseEvidenceFileEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CaseEvidenceFileEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id =
      typeof item.id === "string" ? item.id : `ref_${Math.random().toString(36).slice(2, 12)}`;
    const label = typeof item.label === "string" ? item.label.trim() : "";
    let evidence_id =
      typeof item.evidence_id === "string" && item.evidence_id.trim() ? item.evidence_id.trim() : null;
    const file_reference =
      typeof item.file_reference === "string" && item.file_reference.trim()
        ? item.file_reference.trim()
        : null;
    const notes = typeof item.notes === "string" && item.notes.trim() ? item.notes.trim() : null;
    if (!evidence_id && file_reference?.includes("/evidence/")) {
      const m = file_reference.match(/\/evidence\/([^/?#]+)/);
      if (m?.[1]) evidence_id = m[1];
    }
    if (!label && !evidence_id && !file_reference && !notes) continue;
    out.push({ id, label, file_reference, notes, evidence_id });
  }
  return out;
}

export function parseIncidentEntries(raw: unknown): CaseIncidentEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: CaseIncidentEntry[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const id = typeof item.id === "string" && item.id.trim() ? item.id : newIncidentEntryId();
    const incident_title = typeof item.incident_title === "string" ? item.incident_title : "";
    const description = typeof item.description === "string" ? item.description : "";
    const date = typeof item.date === "string" && item.date.trim() ? item.date.trim() : null;
    const city = typeof item.city === "string" ? item.city : "";
    const state = typeof item.state === "string" ? item.state : "";
    const address_line_1 = typeof item.address_line_1 === "string" ? item.address_line_1 : "";
    const address_line_2 = typeof item.address_line_2 === "string" ? item.address_line_2 : "";
    let year: number | null = null;
    if (typeof item.year === "number" && Number.isFinite(item.year)) year = item.year;
    const people = parseCasePeople(item.people);
    const charges = typeof item.charges === "string" ? item.charges : "";
    const legal_milestones = parseLegalMilestones(item.legal_milestones);
    const evidence_items = parseEvidenceFileEntries(item.evidence_items);
    out.push({
      id,
      incident_title,
      description,
      date,
      city,
      state,
      address_line_1,
      address_line_2,
      year,
      people,
      charges,
      legal_milestones,
      evidence_items,
    });
  }
  return out;
}

function peopleFromAllIncidentEntries(c: CaseRow): CasePerson[] {
  const raw = (c as { incident_entries?: unknown }).incident_entries;
  const entries = parseIncidentEntries(raw);
  const merged: CasePerson[] = [];
  for (const e of entries) merged.push(...e.people);
  return merged;
}

/** `case_people` when set; else from `incident_entries`; else legacy columns. */
export function resolvedCasePeople(caseRow: CaseRow): CasePerson[] {
  let people = parseCasePeople((caseRow as { case_people?: unknown }).case_people);
  if (people.length === 0) {
    people = peopleFromAllIncidentEntries(caseRow);
  }
  if (people.length === 0) {
    const case_victims = parseStringArray((caseRow as { case_victims?: unknown }).case_victims);
    const case_accused = parseStringArray((caseRow as { case_accused?: unknown }).case_accused);
    case_victims.forEach((name) => people.push({ name, role: "Victim/Accuser" }));
    case_accused.forEach((name) => people.push({ name, role: "Accused" }));
    if (people.length === 0) {
      if (caseRow.victim_labels?.trim()) {
        caseRow.victim_labels
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean)
          .forEach((name) => people.push({ name, role: "Victim/Accuser" }));
      }
      if (caseRow.accused_label?.trim()) {
        people.push({ name: caseRow.accused_label.trim(), role: "Accused" });
      }
    }
  }
  return people;
}

/** Readable block for AI prompts (cross-case, etc.). */
export function formatCaseDirectoryForPrompt(caseRow: CaseRow): string {
  const bits: string[] = [];
  const entries = parseIncidentEntries((caseRow as { incident_entries?: unknown }).incident_entries);
  if (entries.length) {
    for (const e of entries) {
      const loc = [e.address_line_1, e.address_line_2, e.city, e.state].filter(Boolean).join(", ");
      const when = e.date || (e.year != null ? String(e.year) : "");
      const head = [e.incident_title, e.description].filter(Boolean).join(" — ");
      const parts = [head, when ? `date: ${when}` : "", loc ? `loc: ${loc}` : ""].filter(Boolean);
      bits.push(`INCIDENT: ${parts.join(" — ")}`);
      if (e.charges?.trim()) bits.push(`  CHARGES: ${e.charges.trim()}`);
      if (e.people.length) {
        bits.push(
          `  PEOPLE: ${e.people.map((p) => `${p.name} (${p.role})`).join("; ")}`,
        );
      }
      const m = e.legal_milestones;
      if (m.length) {
        bits.push(
          `  LEGAL: ${m
            .map((x) =>
              legalActionIsConviction(x.type) && x.sentence_detail
                ? `${x.type} ${x.month_year} (sentence: ${x.sentence_detail})`
                : `${x.type} ${x.month_year}`,
            )
            .join("; ")}`,
        );
      }
      const files = e.evidence_items;
      if (files.length) {
        bits.push(
          `  EVIDENCE: ${files.map((f) => `${f.label}${f.file_reference ? ` (${f.file_reference})` : ""}`).join("; ")}`,
        );
      }
    }
  } else {
    const incidents = parseCaseIncidents(caseRow.incidents);
    if (incidents.length) {
      bits.push(
        `INCIDENTS: ${incidents
          .map((i) => {
            const loc = [i.address_line_1, i.address_line_2, i.city, i.state].filter(Boolean).join(", ");
            const when = i.date || (i.year != null ? String(i.year) : "");
            const parts = [i.description, when ? `date: ${when}` : "", loc ? `loc: ${loc}` : ""].filter(Boolean);
            return parts.join(" — ");
          })
          .join(" | ")}`,
      );
    }
    const people = resolvedCasePeople(caseRow);
    if (people.length) {
      bits.push(
        `PEOPLE: ${people.map((p) => `${p.name} (${p.role})`).join("; ")}`,
      );
    } else {
      if (caseRow.victim_labels?.trim()) bits.push(`VICTIMS: ${caseRow.victim_labels.trim()}`);
      if (caseRow.accused_label?.trim()) bits.push(`ACCUSED: ${caseRow.accused_label.trim()}`);
    }
    if (caseRow.charges?.trim()) bits.push(`CHARGES: ${caseRow.charges.trim()}`);
    const m = parseLegalMilestones(caseRow.legal_milestones);
    if (m.length) {
      bits.push(
        `LEGAL_ACTIONS: ${m
          .map((x) =>
            legalActionIsConviction(x.type) && x.sentence_detail
              ? `${x.type} ${x.month_year} (sentence: ${x.sentence_detail})`
              : `${x.type} ${x.month_year}`,
          )
          .join("; ")}`,
      );
    } else {
      if (caseRow.indictment_month_year?.trim()) bits.push(`INDICTMENT_MMYYYY: ${caseRow.indictment_month_year.trim()}`);
      if (caseRow.conviction_month_year?.trim()) bits.push(`CONVICTION_MMYYYY: ${caseRow.conviction_month_year.trim()}`);
      if (caseRow.sentence?.trim()) bits.push(`SENTENCE: ${caseRow.sentence.trim()}`);
    }
    const files = parseEvidenceFileEntries(caseRow.evidence_file_entries);
    if (files.length) {
      bits.push(
        `FILE_REFERENCES: ${files.map((f) => `${f.label}${f.file_reference ? ` (${f.file_reference})` : ""}`).join("; ")}`,
      );
    }
  }
  if (!entries.length) {
    const incidents = parseCaseIncidents(caseRow.incidents);
    if (!incidents.length && (caseRow.incident_year != null || caseRow.incident_city || caseRow.incident_state)) {
      bits.push(
        `LEGACY_LOCATION: ${[caseRow.incident_city, caseRow.incident_state, caseRow.incident_year != null ? String(caseRow.incident_year) : ""].filter(Boolean).join(", ")}`,
      );
    }
  }
  return bits.join("\n");
}

export function caseDirectorySearchBlob(c: CaseRow): string {
  const entries = parseIncidentEntries((c as { incident_entries?: unknown }).incident_entries);
  const legacyParts = [
    c.title,
    c.description,
    c.accused_label,
    c.victim_labels,
    c.charges,
    c.indictment_month_year,
    c.conviction_month_year,
    c.sentence,
    c.incident_city,
    c.incident_state,
    c.incident_year != null ? String(c.incident_year) : "",
  ];

  if (entries.length) {
    const structured = entries.flatMap((e) => [
      e.incident_title,
      e.description,
      e.date ?? "",
      e.city,
      e.state,
      e.address_line_1 ?? "",
      e.address_line_2 ?? "",
      e.year != null ? String(e.year) : "",
      e.charges,
      ...e.people.flatMap((p) => [p.name, p.role]),
      ...e.legal_milestones.flatMap((m) => [m.type, m.month_year, m.sentence_detail ?? ""]),
      ...e.evidence_items.flatMap((f) => [
        f.label,
        f.file_reference ?? "",
        f.notes ?? "",
        f.evidence_id ?? "",
      ]),
    ]);
    return [...legacyParts, ...structured.map((x) => (x ?? "").toLowerCase())].join(" ");
  }

  const incidents = parseCaseIncidents((c as { incidents?: unknown }).incidents);
  const people = resolvedCasePeople(c);
  const milestones = parseLegalMilestones((c as { legal_milestones?: unknown }).legal_milestones);
  const files = parseEvidenceFileEntries((c as { evidence_file_entries?: unknown }).evidence_file_entries);

  const structured = [
    ...incidents.flatMap((i) => [
      i.description,
      i.date ?? "",
      i.city,
      i.state,
      i.address_line_1 ?? "",
      i.address_line_2 ?? "",
      i.year != null ? String(i.year) : "",
    ]),
    ...people.flatMap((p) => [p.name, p.role]),
    ...milestones.flatMap((m) => [m.type, m.month_year, m.sentence_detail ?? ""]),
    ...files.flatMap((f) => [f.label, f.file_reference ?? "", f.notes ?? ""]),
  ];

  return [...legacyParts, ...structured]
    .map((x) => (x ?? "").toLowerCase())
    .join(" ");
}

/** Migrate legacy flat columns into grouped incident entries when `incident_entries` is empty. */
function migrateFlatRowToIncidentEntries(c: CaseRow): CaseIncidentEntry[] {
  let incidents = parseCaseIncidents((c as { incidents?: unknown }).incidents);
  if (incidents.length === 0 && (c.incident_city || c.incident_state || c.incident_year != null)) {
    incidents = [
      {
        description: "",
        date: null,
        city: c.incident_city ?? "",
        state: c.incident_state ?? "",
        address_line_1: "",
        address_line_2: "",
        year: c.incident_year ?? null,
      },
    ];
  }

  const people = resolvedCasePeople(c);
  let legal_milestones = parseLegalMilestones((c as { legal_milestones?: unknown }).legal_milestones);
  if (legal_milestones.length === 0) {
    if (c.indictment_month_year?.trim()) {
      legal_milestones.push({
        type: canonicalizeLegalActionLabel("indictment"),
        month_year: c.indictment_month_year.trim(),
      });
    }
    if (c.conviction_month_year?.trim()) {
      legal_milestones.push({
        type: canonicalizeLegalActionLabel("conviction"),
        month_year: c.conviction_month_year.trim(),
        sentence_detail: c.sentence?.trim() || null,
      });
    }
  }

  const evidence_items = parseEvidenceFileEntries((c as { evidence_file_entries?: unknown }).evidence_file_entries);
  const charges = c.charges ?? "";

  if (incidents.length === 0) {
    if (
      !people.length &&
      !charges.trim() &&
      !legal_milestones.length &&
      !evidence_items.length
    ) {
      return [];
    }
    return [
      {
        id: newIncidentEntryId(),
        incident_title: "",
        description: "",
        date: null,
        city: "",
        state: "",
        address_line_1: "",
        address_line_2: "",
        year: null,
        people,
        charges,
        legal_milestones,
        evidence_items,
      },
    ];
  }

  return incidents.map((inc, idx) => ({
    id: newIncidentEntryId(),
    incident_title: "",
    description: inc.description,
    date: inc.date,
    city: inc.city ?? "",
    state: inc.state ?? "",
    address_line_1: inc.address_line_1 ?? "",
    address_line_2: inc.address_line_2 ?? "",
    year: inc.year ?? null,
    people: idx === 0 ? people : [],
    charges: idx === 0 ? charges : "",
    legal_milestones: idx === 0 ? legal_milestones : [],
    evidence_items: idx === 0 ? evidence_items : [],
  }));
}

/** One grouped entry built only from a legacy `incidents[]` row (no shared people/charges). */
function incidentEntryFromLegacyIncidentRow(inc: CaseIncident): CaseIncidentEntry {
  return {
    id: newIncidentEntryId(),
    incident_title: "",
    description: inc.description,
    date: inc.date,
    city: inc.city ?? "",
    state: inc.state ?? "",
    address_line_1: inc.address_line_1 ?? "",
    address_line_2: inc.address_line_2 ?? "",
    year: inc.year ?? null,
    people: [],
    charges: "",
    legal_milestones: [],
    evidence_items: [],
  };
}

/** Build initial form state from DB row (grouped entries + legacy fallback). */
export function directoryPayloadFromCaseRow(c: CaseRow): CaseDirectoryPayload {
  let incident_entries = parseIncidentEntries((c as { incident_entries?: unknown }).incident_entries);
  const legacyIncidents = parseCaseIncidents((c as { incidents?: unknown }).incidents);

  if (incident_entries.length === 0) {
    incident_entries = migrateFlatRowToIncidentEntries(c);
  } else if (legacyIncidents.length > incident_entries.length) {
    const tail = legacyIncidents.slice(incident_entries.length);
    incident_entries = [...incident_entries, ...tail.map(incidentEntryFromLegacyIncidentRow)];
  }
  return {
    incident_entries,
  };
}
