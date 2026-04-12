import {
  TIMELINE_KIND_LABELS,
  TIMELINE_TIER_LABELS,
  type AnalysisSupplemental,
} from "@/types/analysis";
import { AuthenticityBadge } from "@/components/authenticity-badge";
import { EntityCategoryBadges } from "@/components/entity-category-badges";
import { normalizeCategoryToken } from "@/lib/investigation-categories";
import type { InvestigationCategorySlug } from "@/types/analysis";

/** Optional graph-style data from the same model response (not the primary finding). */
export function AnalysisSupplementalPanel({ supplemental }: { supplemental: AnalysisSupplemental }) {
  const has =
    supplemental.entities.length > 0 ||
    supplemental.timeline.length > 0 ||
    supplemental.relationships.length > 0 ||
    (supplemental.evidence_clusters?.length ?? 0) > 0 ||
    (supplemental.evidence_links?.length ?? 0) > 0;

  if (!has) {
    return (
      <p className="text-xs text-muted-foreground border border-zinc-800 rounded-lg px-3 py-2 bg-zinc-950/80">
        No supplemental graph data in this run (entities, timeline, relationships, clusters, or links).
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950/50 text-foreground text-sm space-y-4 p-4">
      {supplemental.entities.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Entities</h4>
          <ul className="space-y-2">
            {supplemental.entities.map((e, i) => {
              const cats = (e.categories ?? [])
                .map((c) => normalizeCategoryToken(c))
                .filter((c): c is InvestigationCategorySlug => c != null);
              return (
                <li key={i} className="border border-zinc-800 rounded-md px-3 py-2 space-y-2">
                  <div>
                    <span className="font-medium text-foreground">{e.label}</span>{" "}
                    <span className="text-muted-foreground">({e.entity_type})</span>
                  </div>
                  <EntityCategoryBadges categories={cats} />
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
      {supplemental.timeline.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Timeline</h4>
          <ul className="space-y-2">
            {supplemental.timeline.map((t, i) => (
              <li key={i} className="border border-zinc-800 rounded-md px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{t.title}</span>
                  {t.timeline_kind_resolved ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide border border-violet-500/40 text-violet-200/90 rounded px-1.5 py-0.5">
                      {TIMELINE_KIND_LABELS[t.timeline_kind_resolved]}
                    </span>
                  ) : null}
                  {t.timeline_tier_resolved ? (
                    <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground border border-zinc-700 rounded px-1.5 py-0.5">
                      {TIMELINE_TIER_LABELS[t.timeline_tier_resolved]}
                    </span>
                  ) : null}
                  {t.authenticity_label ? <AuthenticityBadge value={t.authenticity_label} /> : null}
                </div>
                <div className="text-xs text-muted-foreground">{t.occurred_at ?? "—"}</div>
                {t.summary ? <p className="text-muted-foreground mt-1">{t.summary}</p> : null}
                {(t.supporting_evidence_filenames?.length ?? 0) > 0 ? (
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Supporting files: {t.supporting_evidence_filenames!.join(", ")}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {supplemental.relationships.length > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Entity relationships
          </h4>
          <ul className="space-y-2">
            {supplemental.relationships.map((r, i) => (
              <li key={i} className="border border-zinc-800 rounded-md px-3 py-2 text-sm">
                {r.source_label} → {r.target_label}{" "}
                <span className="text-muted-foreground">({r.relation_type})</span>
                {r.description ? <p className="text-muted-foreground mt-1">{r.description}</p> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(supplemental.evidence_clusters?.length ?? 0) > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Evidence clusters
          </h4>
          <ul className="space-y-2">
            {supplemental.evidence_clusters!.map((c, i) => (
              <li key={i} className="border border-zinc-800 rounded-md px-3 py-2 text-xs">
                <div className="font-medium text-foreground">{c.title ?? "Cluster"}</div>
                {c.rationale ? <p className="text-muted-foreground mt-1">{c.rationale}</p> : null}
                <p className="text-muted-foreground mt-1">
                  Related files (hints / resolved by shared content):{" "}
                  {c.evidence_filenames?.length ? c.evidence_filenames.join(", ") : "—"}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {(supplemental.evidence_links?.length ?? 0) > 0 ? (
        <section>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
            Cross-evidence links
          </h4>
          <ul className="space-y-1">
            {supplemental.evidence_links!.map((l, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                →{" "}
                {l.target_evidence_filename?.trim()
                  ? l.target_evidence_filename
                  : "(target resolved from shared entities / text — filename optional)"}{" "}
                <span className="text-muted-foreground">({l.link_type ?? "related"})</span>
                {l.description ? (
                  <span className="block text-muted-foreground mt-0.5">{l.description}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
