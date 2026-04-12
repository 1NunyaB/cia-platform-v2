import Link from "next/link";
import {
  INVESTIGATION_CATEGORIES,
  normalizeEntityCategory,
  type InvestigationCategory,
} from "@/lib/investigation-categories";
import type { EntityRow } from "@/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function bucketEntities(entities: EntityRow[]) {
  const buckets: Record<InvestigationCategory, EntityRow[]> = Object.fromEntries(
    INVESTIGATION_CATEGORIES.map((c) => [c, []]),
  ) as Record<InvestigationCategory, EntityRow[]>;
  const uncategorized: EntityRow[] = [];
  for (const e of entities) {
    const cat = normalizeEntityCategory(e.entity_type);
    if (cat) buckets[cat].push(e);
    else uncategorized.push(e);
  }
  return { buckets, uncategorized };
}

export function CaseInvestigationBoard({
  caseId,
  entities,
  embedded = false,
}: {
  caseId: string;
  entities: EntityRow[];
  /** When true, omit the board heading (parent section already titles this block). */
  embedded?: boolean;
}) {
  const { buckets, uncategorized } = bucketEntities(entities);
  const total = entities.length;

  if (total === 0) {
    return (
      <Card id="investigation-categories" className="scroll-mt-24 border-dashed border-border/80 bg-card/40">
        <CardHeader>
          <CardTitle className="text-base">{embedded ? "No entities yet" : "Investigation model"}</CardTitle>
          <CardDescription>
            {embedded
              ? "Categories: Core Actors, Money, Political, Tech, Intel, Convicted, Accusers, Accused, Dead. Data appears after analysis or manual entry."
              : "Entities populate when you run analysis on evidence. Categories follow this workspace model: Core Actors, Money, Political, Tech, Intel, Convicted, Accusers, Accused, Dead."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Upload a document, then open the file and run analysis — or add entities manually later.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div id="investigation-categories" className="scroll-mt-24 space-y-4">
      {!embedded ? (
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Investigation model</h2>
            <p className="text-sm text-muted-foreground">
              {total} entit{total === 1 ? "y" : "ies"} grouped by category. Types come from AI analysis or manual
              entry.
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {total} total
          </Badge>
        </div>
      ) : (
        <div className="flex justify-end">
          <Badge variant="outline" className="font-mono text-xs">
            {total} entit{total === 1 ? "y" : "ies"}
          </Badge>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {INVESTIGATION_CATEGORIES.map((cat) => {
          const list = buckets[cat];
          return (
            <Card key={cat} className="border-border/60 bg-card/60 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium leading-tight">{cat}</CardTitle>
                <CardDescription className="text-xs">{list.length} in this bucket</CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                {list.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No entries yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {list.map((e) => (
                      <li key={e.id} className="text-sm">
                        <span className="font-medium text-foreground">{e.label}</span>
                        {e.evidence_file_id ? (
                          <Link
                            href={`/cases/${caseId}/evidence/${e.evidence_file_id}`}
                            className="ml-2 text-xs text-primary/90 hover:underline"
                          >
                            Source
                          </Link>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
      {uncategorized.length > 0 ? (
        <Card className="border-border/60 bg-muted/20">
          <CardHeader>
            <CardTitle className="text-base">Other / uncategorized</CardTitle>
            <CardDescription>Entity types that do not match the nine canonical buckets.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {uncategorized.map((e) => (
                <li key={e.id} className="flex flex-wrap items-baseline gap-2 text-sm">
                  <span className="font-medium">{e.label}</span>
                  <span className="text-xs text-muted-foreground">({e.entity_type ?? "—"})</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
