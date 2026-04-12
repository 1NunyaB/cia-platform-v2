import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCaseById } from "@/services/case-service";
import { searchCaseRegistry } from "@/services/case-registry-search-service";
import { EntityCategoryBadges } from "@/components/entity-category-badges";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestigationCategorySlug } from "@/types/analysis";

function matchBadge(kind: "exact" | "alias" | "name_variant") {
  const styles: Record<typeof kind, string> = {
    exact: "border-emerald-500/50 text-emerald-400/95 bg-emerald-500/10",
    alias: "border-sky-500/50 text-sky-400/95 bg-sky-500/10",
    name_variant: "border-amber-500/45 text-amber-400/90 bg-amber-500/10",
  };
  const labels: Record<typeof kind, string> = {
    exact: "Exact match",
    alias: "Alias match",
    name_variant: "Correlated name variant",
  };
  return (
    <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${styles[kind]}`}>
      {labels[kind]}
    </span>
  );
}

export default async function CaseEntitiesPage({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const { caseId } = await params;
  const { q } = await searchParams;
  const supabase = await createClient();

  const c = await getCaseById(supabase, caseId);
  if (!c) notFound();

  const needle = (q ?? "").trim();
  const { hits, evidenceFileHits } = await searchCaseRegistry(supabase, caseId, needle);

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <p className="text-sm text-muted-foreground">
          <Link href={`/cases/${caseId}`} className="hover:underline">
            ← Case
          </Link>
        </p>
        <h1 className="text-2xl font-semibold tracking-tight mt-2">Entities — {c.title}</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Canonical names with investigation category tags (many-to-many). Merged across evidence in this case.
          Aliases are identity markers attached to the primary label — they do not replace the registry name.
        </p>
      </div>

      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Search registry</CardTitle>
          <CardDescription>
            Matches primary labels, stored aliases, and conservative normalized variants. Results show timeline hooks
            and contradiction hints where available.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form method="get" className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={needle}
              placeholder="Name, alias, or variant…"
              className="flex-1 min-w-[200px] rounded-md border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-sky-500/40"
            />
            <button
              type="submit"
              className="rounded-md border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-foreground hover:bg-zinc-700"
            >
              Search
            </button>
            {needle ? (
              <Link
                href={`/cases/${caseId}/entities`}
                className="text-sm text-sky-400 hover:underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
          {needle ? (
            <p className="text-xs text-sky-400/90 mt-3">
              Active query: “{needle}” — {hits.length} entit{hits.length === 1 ? "y" : "ies"} matched
              {evidenceFileHits.length > 0
                ? ` · ${evidenceFileHits.length} evidence file${evidenceFileHits.length === 1 ? "" : "s"} by name or alias`
                : ""}
              .
            </p>
          ) : null}
        </CardContent>
      </Card>

      {needle && evidenceFileHits.length > 0 ? (
        <Card className="border-zinc-800 bg-zinc-950/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evidence files (name / alias)</CardTitle>
            <CardDescription>
              Matches original filename, numbered display name, or short alias — without requiring an entity row.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {evidenceFileHits.map((h) => (
                <li
                  key={h.id}
                  className="rounded-md border border-zinc-800/90 bg-zinc-950/50 px-3 py-2 text-sm"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <span className="font-medium text-foreground">{h.title}</span>
                    {h.evidence_file_id ? (
                      <Link
                        href={`/cases/${caseId}/evidence/${h.evidence_file_id}`}
                        className="text-xs text-sky-400 hover:underline shrink-0"
                      >
                        Open
                      </Link>
                    ) : null}
                  </div>
                  {h.snippet ? (
                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{h.snippet}</p>
                  ) : null}
                  {h.matched_via_alias ? (
                    <p className="text-[10px] text-amber-400/85 mt-1 uppercase tracking-wide">Matched via display name or alias</p>
                  ) : null}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-zinc-800 bg-zinc-950/80">
        <CardHeader>
          <CardTitle>Entity registry</CardTitle>
          <CardDescription>Structured labels, categories, aliases, and linked evidence signals.</CardDescription>
        </CardHeader>
        <CardContent>
          {!hits.length ? (
            <p className="text-sm text-muted-foreground">
              {needle ? "No entities matched this query." : "No entities stored for this case yet."}
            </p>
          ) : (
            <ul className="divide-y rounded-md border border-zinc-800">
              {hits.map((row) => {
                const e = row.entity;
                const cats = (e.entity_categories ?? []).map(
                  (x) => x.category as InvestigationCategorySlug,
                );
                const aliases = e.entity_aliases ?? [];
                return (
                  <li key={e.id} className="p-4 space-y-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-lg text-foreground">{e.label}</span>
                          {needle ? matchBadge(row.match_kind) : null}
                          <span className="text-muted-foreground text-sm">{e.entity_type ?? "—"}</span>
                        </div>
                        {row.matched_alias_display ? (
                          <p className="text-xs text-sky-400/85">
                            Matched alias: <span className="font-medium">{row.matched_alias_display}</span>
                          </p>
                        ) : null}
                      </div>
                      {e.evidence_file_id ? (
                        <Link
                          href={`/cases/${caseId}/evidence/${e.evidence_file_id}`}
                          className="text-xs text-primary hover:underline shrink-0"
                        >
                          Source evidence
                        </Link>
                      ) : null}
                    </div>

                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Categories</p>
                      <EntityCategoryBadges categories={cats} />
                    </div>

                    <div className="rounded-md border border-zinc-800/90 bg-zinc-950/60 p-3 space-y-2">
                      <p className="text-xs font-medium text-foreground uppercase tracking-wide">Aliases</p>
                      {!aliases.length ? (
                        <p className="text-xs text-muted-foreground">No aliases recorded for this entity yet.</p>
                      ) : (
                        <ul className="flex flex-wrap gap-2">
                          {aliases.map((a) => (
                            <li
                              key={a.id}
                              className="text-xs rounded border border-zinc-700/80 bg-zinc-900/50 px-2 py-1 text-zinc-200"
                              title={
                                a.evidence_file_id
                                  ? "Linked from analysis-derived evidence (traceable)"
                                  : "Registry alias"
                              }
                            >
                              <span className="text-foreground">{a.alias_display}</span>
                              <span className="text-muted-foreground ml-1">({a.strength})</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {needle && row.evidence.length > 0 ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-foreground">Matching evidence & references</p>
                        <ul className="space-y-2 text-xs">
                          {row.evidence.slice(0, 12).map((hit) => (
                            <li
                              key={hit.id}
                              className="rounded border border-zinc-800/80 bg-black/20 p-2 text-muted-foreground"
                            >
                              <div className="flex flex-wrap justify-between gap-1 text-[11px] uppercase tracking-wide text-zinc-500">
                                <span>{hit.kind.replace(/_/g, " ")}</span>
                                {hit.matched_via_alias ? (
                                  <span className="text-amber-400/90">Alias-linked signal</span>
                                ) : null}
                              </div>
                              <p className="text-foreground mt-1">{hit.title}</p>
                              {hit.snippet ? (
                                <p className="mt-1 text-muted-foreground leading-relaxed line-clamp-3">
                                  {hit.snippet}
                                </p>
                              ) : null}
                              {hit.evidence_file_id ? (
                                <Link
                                  href={`/cases/${caseId}/evidence/${hit.evidence_file_id}`}
                                  className="inline-block mt-1 text-sky-400 hover:underline"
                                >
                                  Open evidence
                                </Link>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                        {row.evidence.length > 12 ? (
                          <p className="text-[11px] text-muted-foreground">
                            +{row.evidence.length - 12} more hits (refine search to narrow).
                          </p>
                        ) : null}
                      </div>
                    ) : null}

                    {needle ? (
                      <div className="rounded-md border border-zinc-800/80 bg-zinc-950/40 p-3 space-y-2">
                        <p className="text-xs font-medium text-foreground">Timeline & contradiction hints</p>
                        <ul className="text-xs text-muted-foreground space-y-1">
                          <li>
                            Supporting timeline events (text match):{" "}
                            <span className="text-foreground">
                              {row.contradiction.supporting_timeline_event_ids.length}
                            </span>
                          </li>
                          {row.contradiction.timeline_conflict_signals.length > 0 ? (
                            <li className="text-amber-400/90">
                              Cross-timeline tension:{" "}
                              {row.contradiction.timeline_conflict_signals
                                .slice(0, 3)
                                .map((s) => s.summary)
                                .join(" · ")}
                            </li>
                          ) : (
                            <li>No cross-timeline conflict heuristic triggered for matched events.</li>
                          )}
                          {row.contradiction.intra_file_opposition ? (
                            <li className="text-rose-400/85">
                              Opposing cues within the same evidence file (mentions) — review before merging accounts.
                            </li>
                          ) : null}
                          {row.contradiction.possible_date_anchor_hits > 0 ? (
                            <li>
                              Possible new time anchors (dates in matching text without a same-day timeline row):{" "}
                              <span className="text-foreground">{row.contradiction.possible_date_anchor_hits}</span>
                            </li>
                          ) : null}
                        </ul>
                        <Link
                          href={`/cases/${caseId}/timeline`}
                          className="inline-block text-xs text-sky-400 hover:underline"
                        >
                          Open timelines
                        </Link>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
