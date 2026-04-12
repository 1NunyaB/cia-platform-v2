import type { AppSupabaseClient } from "@/types";
import type { TimelineKind, TimelineTier } from "@/types/analysis";
import { detectTimelineConflicts, type TimelineConflictInput } from "@/lib/timeline-conflicts";

type SourceRow = {
  id: string;
  title: string;
  summary: string | null;
  occurred_at: string | null;
  timeline_tier: TimelineTier | null;
  timeline_kind: TimelineKind;
  contextual_time_inference: Record<string, unknown> | null;
  source_label: string | null;
  event_classification: string | null;
  event_reasoning: string | null;
  event_limitations: string | null;
  timeline_event_evidence: { evidence_file_id: string }[] | null;
};

/**
 * Deletes prior reconstructed rows for the case and inserts a single synthesized overview row
 * that separates confirmed vs inferred vs uncertain material and lists cross-timeline conflicts without resolving them.
 */
export async function regenerateReconstructedTimeline(
  supabase: AppSupabaseClient,
  caseId: string,
): Promise<{ created: number }> {
  const { error: delErr } = await supabase
    .from("timeline_events")
    .delete()
    .eq("case_id", caseId)
    .eq("timeline_kind", "reconstructed");
  if (delErr) throw new Error(delErr.message);

  const { data: rows, error: fetchErr } = await supabase
    .from("timeline_events")
    .select(
      `
      id,
      title,
      summary,
      occurred_at,
      timeline_tier,
      timeline_kind,
      contextual_time_inference,
      source_label,
      event_classification,
      event_reasoning,
      event_limitations,
      timeline_event_evidence ( evidence_file_id )
    `,
    )
    .eq("case_id", caseId)
    .neq("timeline_kind", "reconstructed");

  if (fetchErr) throw new Error(fetchErr.message);
  const list = (rows ?? []) as unknown as SourceRow[];
  if (list.length === 0) return { created: 0 };

  const conflictInputs: TimelineConflictInput[] = list.map((r) => ({
    id: r.id,
    title: r.title,
    summary: r.summary,
    occurred_at: r.occurred_at,
    timeline_kind: r.timeline_kind,
  }));
  const conflicts = detectTimelineConflicts(conflictInputs);

  const confirmedParts: string[] = [];
  const inferredParts: string[] = [];
  const uncertainParts: string[] = [];

  for (const r of list) {
    const when = r.occurred_at ? new Date(r.occurred_at).toISOString().slice(0, 10) : "unknown date";
    const lane = r.timeline_kind;
    const line = `• [${lane}] ${when}: ${r.title}${r.summary ? ` — ${r.summary.slice(0, 280)}${r.summary.length > 280 ? "…" : ""}` : ""}`;
    const tier = r.timeline_tier ?? "t3_leads";
    const hasCtx = Boolean(r.contextual_time_inference && Object.keys(r.contextual_time_inference).length > 0);

    if (tier === "t1_confirmed") {
      confirmedParts.push(line);
    } else if (tier === "t2_supported" || (tier === "t3_leads" && hasCtx)) {
      inferredParts.push(line + (hasCtx ? " (timing uses contextual anchors — treat as supported or leads unless independently verified)" : ""));
    } else {
      uncertainParts.push(line);
    }
  }

  const conflictBlock =
    conflicts.length === 0
      ? "No automatic cross-timeline conflict signals for the current heuristic (review manually in each lane)."
      : conflicts
          .map((c, i) => `${i + 1}. ${c.summary}`)
          .join("\n");

  const summary = [
    "## Confirmed (strong tier / explicit alignment)",
    confirmedParts.length ? confirmedParts.join("\n") : "— None recorded as Timeline 1 in source lanes; strengthen sourcing to populate this block.",
    "",
    "## Inferred or supported (includes anchoring, environmental cues, cross-file patterns)",
    inferredParts.length ? inferredParts.join("\n") : "— No separate inferred bucket beyond uncertain rows.",
    "",
    "## Uncertain / leads",
    uncertainParts.length ? uncertainParts.join("\n") : "— None listed as leads-only.",
    "",
    "## Cross-timeline conflicts (not auto-resolved)",
    conflictBlock,
  ].join("\n");

  const reasoning =
    `Synthesized from ${list.length} non-reconstructed events. ` +
    `Uses cross-referenced evidence membership, timeline tiers, and contextual inference flags. ` +
    `Inference techniques (e.g. shadow analysis, environmental conditions, event anchoring) remain classified as Supported or Leads in source lanes unless independently verified.`;

  const limitations =
    "This reconstructed lane is an overview only; it does not replace witness, official, or evidence timelines. " +
    "Conflicts are highlighted, not adjudicated.";

  const evidenceIds = new Set<string>();
  for (const r of list) {
    for (const row of r.timeline_event_evidence ?? []) {
      if (row.evidence_file_id) evidenceIds.add(row.evidence_file_id);
    }
  }

  const { data: inserted, error: insErr } = await supabase
    .from("timeline_events")
    .insert({
      case_id: caseId,
      evidence_file_id: null,
      ai_analysis_id: null,
      occurred_at: null,
      title: "Reconstructed overview (cross-timeline synthesis)",
      summary,
      timeline_tier: "t2_supported" satisfies TimelineTier,
      timeline_kind: "reconstructed",
      source_label: "Platform synthesis",
      event_classification: "Reconstructed",
      event_reasoning: reasoning,
      event_limitations: limitations,
      contextual_time_inference: null,
    })
    .select("id")
    .single();

  if (insErr) throw new Error(insErr.message);
  const tid = inserted!.id as string;

  for (const eid of evidenceIds) {
    const { error: ejErr } = await supabase.from("timeline_event_evidence").insert({
      timeline_event_id: tid,
      evidence_file_id: eid,
    });
    if (ejErr && ejErr.code !== "23505") throw new Error(ejErr.message);
  }

  return { created: 1 };
}
