import type { AppSupabaseClient } from "@/types";
import { normalizeEntityOrAliasKey, nameInitialKeys, tokenJaccard } from "@/lib/alias-normalize";
import { detectTimelineConflicts, type TimelineConflictInput } from "@/lib/timeline-conflicts";
import { normalizeTimelineKind } from "@/lib/timeline-kind-schema";
import type { EntityAliasRow, EntityWithCategories } from "@/services/case-investigation-query";

export type RegistryMatchKind = "exact" | "alias" | "name_variant";

export type RegistryEvidenceHit = {
  id: string;
  kind: "entity_mention" | "extract_text" | "filename" | "note" | "timeline_event";
  evidence_file_id: string | null;
  title: string;
  snippet?: string | null;
  matched_via_alias: boolean;
};

export type ContradictionIndicators = {
  timeline_conflict_signals: { summary: string; lanePair: string }[];
  supporting_timeline_event_ids: string[];
  intra_file_opposition: boolean;
  possible_date_anchor_hits: number;
};

export type EntityRegistryHit = {
  entity: EntityWithCategories;
  match_kind: RegistryMatchKind;
  matched_alias_display?: string;
  evidence: RegistryEvidenceHit[];
  contradiction: ContradictionIndicators;
};

export type CaseRegistrySearchPayload = {
  needle: string;
  /** Ranked / filtered rows when needle non-empty; otherwise mirrors registry order. */
  hits: EntityRegistryHit[];
  /** Evidence rows matching display name, short alias, or original filename (no entity match required). */
  evidenceFileHits: RegistryEvidenceHit[];
};

const OPPOSITION_PAIRS: [RegExp, RegExp][] = [
  [/(\bno\b|\bnot\b|\bnever\b|\bdid not\b|\bdenies\b)/i, /(\byes\b|\bdid\b|\bconfirms\b|\bstates\b)/i],
];

function textOpposition(a: string, b: string): boolean {
  const blob = `${a}\n${b}`;
  if (blob.length < 24) return false;
  for (const [rx1, rx2] of OPPOSITION_PAIRS) {
    if (rx1.test(a) && rx2.test(b)) return true;
    if (rx2.test(a) && rx1.test(b)) return true;
  }
  return false;
}

function classifyMatch(
  primaryLabel: string,
  aliases: EntityAliasRow[] | undefined,
  needleRaw: string,
): { kind: RegistryMatchKind | null; matchedAlias?: string } {
  const needle = normalizeEntityOrAliasKey(needleRaw);
  if (!needle) return { kind: null };

  const primary = normalizeEntityOrAliasKey(primaryLabel);
  if (needle === primary) return { kind: "exact" };

  for (const a of aliases ?? []) {
    if (needle === normalizeEntityOrAliasKey(a.alias_display)) {
      return { kind: "alias", matchedAlias: a.alias_display };
    }
  }

  if (needle.length >= 2) {
    if (primary.includes(needle) || needle.includes(primary)) {
      return { kind: "name_variant" };
    }
  }

  const ij = tokenJaccard(primaryLabel, needleRaw);
  if (ij >= 0.38 && primaryLabel.length > 4 && needleRaw.length > 4) {
    return { kind: "name_variant" };
  }

  const initials = nameInitialKeys(primaryLabel);
  if (initials.includes(needle.replace(/\s+/g, ""))) {
    return { kind: "name_variant" };
  }

  return { kind: null };
}

function extractedRawFromFileRow(f: Record<string, unknown>): string {
  const et = f.extracted_texts;
  if (Array.isArray(et)) {
    return et
      .map((row) => String((row as { raw_text?: string | null }).raw_text ?? ""))
      .filter(Boolean)
      .join("\n\n");
  }
  if (et && typeof et === "object" && "raw_text" in (et as object)) {
    return String((et as { raw_text?: string | null }).raw_text ?? "");
  }
  return "";
}

function isoDatesInText(s: string): string[] {
  const out: string[] = [];
  const re = /\b(\d{4}-\d{2}-\d{2})\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    out.push(m[1]!);
  }
  return out;
}

/**
 * Case registry search: entity label + stored aliases + normalized variants; evidence and timeline hooks.
 */
export async function searchCaseRegistry(
  supabase: AppSupabaseClient,
  caseId: string,
  query: string,
): Promise<CaseRegistrySearchPayload> {
  const needle = query.trim();
  const { data: rawEntities, error: entErr } = await supabase
    .from("entities")
    .select(
      "id, label, entity_type, evidence_file_id, entity_categories(category), entity_aliases(id, alias_display, alias_normalized, strength, evidence_file_id)",
    )
    .eq("case_id", caseId)
    .order("label", { ascending: true });

  if (entErr) throw new Error(entErr.message);
  const entities = (rawEntities ?? []) as EntityWithCategories[];

  if (!needle) {
    return {
      needle: "",
      hits: entities.map((ent) => ({
        entity: ent,
        match_kind: "exact" as const,
        evidence: [],
        contradiction: {
          timeline_conflict_signals: [],
          supporting_timeline_event_ids: [],
          intra_file_opposition: false,
          possible_date_anchor_hits: 0,
        },
      })),
      evidenceFileHits: [],
    };
  }

  const entityIds = entities.map((e) => e.id);

  const [{ data: files }, mentionsRes, { data: notes }, { data: timelines }] = await Promise.all([
    supabase
      .from("evidence_files")
      .select("id, original_filename, display_filename, short_alias, extracted_texts(raw_text)")
      .eq("case_id", caseId),
    entityIds.length
      ? supabase.from("entity_mentions").select("id, entity_id, evidence_file_id, snippet").in("entity_id", entityIds)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    supabase.from("notes").select("id, body, evidence_file_id").eq("case_id", caseId),
    supabase
      .from("timeline_events")
      .select("id, title, summary, occurred_at, timeline_kind, evidence_file_id")
      .eq("case_id", caseId),
  ]);

  const { data: mentions } = mentionsRes;

  const fileRows = files ?? [];
  const mentionRows = mentions ?? [];
  const noteRows = notes ?? [];
  const timelineRows = timelines ?? [];

  const timelineInputs: TimelineConflictInput[] = (timelineRows as Record<string, unknown>[]).map((t) => ({
    id: t.id as string,
    title: (t.title as string) ?? "",
    summary: (t.summary as string) ?? null,
    occurred_at: (t.occurred_at as string) ?? null,
    timeline_kind: normalizeTimelineKind(String(t.timeline_kind ?? "evidence")),
  }));

  const allConflicts = detectTimelineConflicts(timelineInputs);

  const hits: EntityRegistryHit[] = [];

  for (const ent of entities) {
    const match = classifyMatch(ent.label, ent.entity_aliases, needle);

    if (!match.kind) continue;

    const searchTerms: { term: string; viaAlias: boolean }[] = [{ term: ent.label, viaAlias: false }];
    for (const a of ent.entity_aliases ?? []) {
      searchTerms.push({ term: a.alias_display, viaAlias: true });
    }
    if (needle && match.kind === "name_variant") {
      searchTerms.push({ term: needle, viaAlias: true });
    }

    const loweredTerms = searchTerms.map((t) => t.term.trim().toLowerCase()).filter((t) => t.length > 0);
    const uniqTerms = [...new Set(loweredTerms)];
    const needleLc = needle.trim().toLowerCase();
    const fileTerms = [...new Set([...uniqTerms, needleLc])].filter((t) => t.length >= 2);

    const evidence: RegistryEvidenceHit[] = [];
    const seen = new Set<string>();

    const pushHit = (h: RegistryEvidenceHit) => {
      const key = `${h.kind}:${h.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      evidence.push(h);
    };

    for (const m of mentionRows) {
      if (m.entity_id !== ent.id) continue;
      const sn = (m.snippet as string) ?? "";
      pushHit({
        id: `mention:${m.id}`,
        kind: "entity_mention",
        evidence_file_id: m.evidence_file_id as string,
        title: "Entity mention",
        snippet: sn.slice(0, 280),
        matched_via_alias: match.kind === "alias" || match.kind === "name_variant",
      });
    }

    for (const f of fileRows) {
      const fr = f as Record<string, unknown>;
      const fn = (fr.original_filename as string) ?? "";
      const fnL = fn.toLowerCase();
      const raw = extractedRawFromFileRow(fr);
      const rawL = raw.toLowerCase();

      const disp = String(fr.display_filename ?? "").toLowerCase();
      const sal = String(fr.short_alias ?? "").toLowerCase();

      for (const term of fileTerms) {
        if (term.length < 2) continue;
        const metaMatch =
          term.length >= 2 &&
          (disp.includes(term) || sal.includes(term) || fnL.includes(term));
        if (metaMatch) {
          pushHit({
            id: `file:${f.id}:meta`,
            kind: "filename",
            evidence_file_id: f.id as string,
            title: String(fr.display_filename ?? fn),
            snippet: fr.short_alias ? `Alias: ${String(fr.short_alias)}` : null,
            matched_via_alias: sal.includes(term) || disp.includes(term),
          });
        } else if (fnL.includes(term)) {
          pushHit({
            id: `file:${f.id}:name`,
            kind: "filename",
            evidence_file_id: f.id as string,
            title: fn,
            snippet: null,
            matched_via_alias: !normalizeEntityOrAliasKey(ent.label).includes(term),
          });
        }
        if (rawL.includes(term)) {
          const idx = rawL.indexOf(term);
          const slice = raw.slice(Math.max(0, idx - 60), idx + term.length + 120);
          pushHit({
            id: `extract:${f.id}:${term.slice(0, 12)}`,
            kind: "extract_text",
            evidence_file_id: f.id as string,
            title: fn,
            snippet: slice,
            matched_via_alias: normalizeEntityOrAliasKey(ent.label) !== term,
          });
        }
      }
    }

    for (const n of noteRows) {
      const body = ((n.body as string) ?? "").toLowerCase();
      for (const term of uniqTerms) {
        if (term.length > 2 && body.includes(term)) {
          pushHit({
            id: `note:${n.id}`,
            kind: "note",
            evidence_file_id: (n.evidence_file_id as string) ?? null,
            title: "Case note",
            snippet: (n.body as string).slice(0, 200),
            matched_via_alias: normalizeEntityOrAliasKey(ent.label) !== term,
          });
          break;
        }
      }
    }

    const supportingTimelineIds: string[] = [];
    for (const t of timelineRows as Record<string, unknown>[]) {
      const blob = `${t.title ?? ""}\n${t.summary ?? ""}`.toLowerCase();
      let hit = false;
      for (const term of uniqTerms) {
        if (term.length > 2 && blob.includes(term)) {
          hit = true;
          break;
        }
      }
      if (hit) {
        supportingTimelineIds.push(t.id as string);
        pushHit({
          id: `tl:${t.id}`,
          kind: "timeline_event",
          evidence_file_id: (t.evidence_file_id as string) ?? null,
          title: (t.title as string) ?? "Timeline event",
          snippet: ((t.summary as string) ?? "").slice(0, 200),
          matched_via_alias: match.kind === "alias" || match.kind === "name_variant",
        });
      }
    }

    const supportingSet = new Set(supportingTimelineIds);
    const relevantConflicts = allConflicts.filter(
      (c) => supportingSet.has(c.eventAId) || supportingSet.has(c.eventBId),
    );

    const mentionSnipsByFile = new Map<string, string[]>();
    for (const m of mentionRows) {
      if (m.entity_id !== ent.id) continue;
      const fid = m.evidence_file_id as string;
      const arr = mentionSnipsByFile.get(fid) ?? [];
      arr.push((m.snippet as string) ?? "");
      mentionSnipsByFile.set(fid, arr);
    }
    let intraOpposed = false;
    for (const [, snips] of mentionSnipsByFile) {
      for (let i = 0; i < snips.length; i++) {
        for (let j = i + 1; j < snips.length; j++) {
          if (textOpposition(snips[i]!, snips[j]!)) intraOpposed = true;
        }
      }
    }

    let anchorHits = 0;
    for (const h of evidence) {
      if (h.kind !== "extract_text" && h.kind !== "note") continue;
      const dates = isoDatesInText(`${h.snippet ?? ""}`);
      for (const d of dates) {
        const hasTl = timelineInputs.some((ev) => {
          if (!ev.occurred_at) return false;
          return ev.occurred_at.slice(0, 10) === d;
        });
        if (!hasTl) anchorHits += 1;
      }
    }

    const contradiction: ContradictionIndicators = {
      timeline_conflict_signals: relevantConflicts.slice(0, 8).map((c) => ({
        summary: c.summary,
        lanePair: `${c.kindA}↔${c.kindB}`,
      })),
      supporting_timeline_event_ids: supportingTimelineIds,
      intra_file_opposition: intraOpposed,
      possible_date_anchor_hits: anchorHits,
    };

    hits.push({
      entity: ent,
      match_kind: match.kind ?? "exact",
      ...(match.matchedAlias ? { matched_alias_display: match.matchedAlias } : {}),
      evidence,
      contradiction,
    });
  }

  const nl = needle.trim().toLowerCase();
  const evidenceFileHits: RegistryEvidenceHit[] = [];
  const seenEv = new Set<string>();
  if (nl.length >= 2) {
    for (const f of fileRows) {
      const fr = f as Record<string, unknown>;
      const id = fr.id as string;
      const orig = String(fr.original_filename ?? "").toLowerCase();
      const disp = String(fr.display_filename ?? "").toLowerCase();
      const sal = String(fr.short_alias ?? "").toLowerCase();
      if (!orig.includes(nl) && !disp.includes(nl) && !sal.includes(nl)) continue;
      if (seenEv.has(id)) continue;
      seenEv.add(id);
      evidenceFileHits.push({
        id: `evidence-label:${id}`,
        kind: "filename",
        evidence_file_id: id,
        title: String(fr.display_filename ?? fr.original_filename ?? id),
        snippet: fr.short_alias
          ? `Short alias: ${String(fr.short_alias)} · Original: ${String(fr.original_filename)}`
          : `Original: ${String(fr.original_filename)}`,
        matched_via_alias: sal.includes(nl) || disp.includes(nl),
      });
    }
  }

  return { needle, hits, evidenceFileHits };
}
