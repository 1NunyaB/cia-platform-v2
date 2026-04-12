import type { TimelineKind } from "@/types/analysis";

const TIMELINE_KIND_LABELS_INLINE: Record<TimelineKind, string> = {
  witness: "Witness",
  subject_actor: "Subject/Actor",
  official: "Official",
  evidence: "Evidence",
  reconstructed: "Reconstructed",
  custom: "Custom",
};

export type TimelineConflictSignal = {
  eventAId: string;
  eventBId: string;
  kindA: TimelineKind;
  kindB: TimelineKind;
  /** Human-readable; platform does not resolve — analyst decides. */
  summary: string;
  occurredDayKey: string | null;
};

function tokenize(s: string): Set<string> {
  const words = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2);
  return new Set(words);
}

function jaccardTitle(a: string, b: string): number {
  const A = tokenize(a);
  const B = tokenize(b);
  if (A.size === 0 && B.size === 0) return 1;
  let inter = 0;
  for (const t of A) {
    if (B.has(t)) inter += 1;
  }
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function dayKey(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const OPPOSITION_PAIRS: [RegExp, RegExp][] = [
  [/(\bno\b|\bnot\b|\bnever\b|\bdid not\b|\bdenies\b)/i, /(\byes\b|\bdid\b|\bconfirms\b|\bstates\b)/i],
];

function hasOpposition(textA: string, textB: string): boolean {
  const blob = `${textA}\n${textB}`;
  if (blob.length < 24) return false;
  for (const [rx1, rx2] of OPPOSITION_PAIRS) {
    if (rx1.test(textA) && rx2.test(textB)) return true;
    if (rx2.test(textA) && rx1.test(textB)) return true;
  }
  return false;
}

export type TimelineConflictInput = {
  id: string;
  title: string;
  summary: string | null;
  occurred_at: string | null;
  timeline_kind: TimelineKind;
};

/**
 * Heuristic cross-timeline conflict detection — same calendar day (or exact timestamp), different lanes,
 * divergent accounts (low lexical overlap or opposing cue words). Does not pick a winner.
 */
export function detectTimelineConflicts(events: TimelineConflictInput[]): TimelineConflictSignal[] {
  const out: TimelineConflictSignal[] = [];
  const list = events.filter((e) => e.timeline_kind !== "reconstructed");

  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i];
      const b = list[j];
      if (a.timeline_kind === b.timeline_kind) continue;

      const dkA = dayKey(a.occurred_at);
      const dkB = dayKey(b.occurred_at);
      const sameDay = dkA && dkB && dkA === dkB;
      const sameInstant =
        a.occurred_at &&
        b.occurred_at &&
        a.occurred_at === b.occurred_at;

      if (!sameDay && !sameInstant) continue;

      const tA = `${a.title}\n${a.summary ?? ""}`;
      const tB = `${b.title}\n${b.summary ?? ""}`;
      const jac = jaccardTitle(a.title, b.title);
      const opposed = hasOpposition(tA, tB);
      const divergent = jac < 0.38 && a.title.length > 6 && b.title.length > 6;

      if (opposed || divergent || (sameInstant && jac < 0.55)) {
        const reason = opposed
          ? "Opposing or contradictory cues in the descriptions."
          : sameInstant
            ? "Same timestamp with different event descriptions across timelines."
            : "Different accounts for the same calendar day with low overlap in wording — review both lanes.";

        out.push({
          eventAId: a.id,
          eventBId: b.id,
          kindA: a.timeline_kind,
          kindB: b.timeline_kind,
          occurredDayKey: dkA ?? dkB,
          summary: `${TIMELINE_KIND_LABELS_INLINE[a.timeline_kind]} vs ${TIMELINE_KIND_LABELS_INLINE[b.timeline_kind]}: ${reason}`,
        });
      }
    }
  }

  return dedupeConflictPairs(out);
}

function dedupeConflictPairs(rows: TimelineConflictSignal[]): TimelineConflictSignal[] {
  const seen = new Set<string>();
  const next: TimelineConflictSignal[] = [];
  for (const r of rows) {
    const a = r.eventAId < r.eventBId ? r.eventAId : r.eventBId;
    const b = r.eventAId < r.eventBId ? r.eventBId : r.eventAId;
    const key = `${a}:${b}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(r);
  }
  return next;
}
