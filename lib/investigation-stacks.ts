/** Canonical investigation stacks (stored as `evidence_clusters.stack_kind` + title). */
export const INVESTIGATION_STACK_KINDS = [
  "location",
  "people",
  "objects",
  "transportation",
  "documents",
  "miscellaneous",
] as const;

export type InvestigationStackKind = (typeof INVESTIGATION_STACK_KINDS)[number];

export const INVESTIGATION_STACK_LABEL: Record<InvestigationStackKind, string> = {
  location: "Location",
  people: "People",
  objects: "Objects",
  transportation: "Transportation",
  documents: "Documents",
  miscellaneous: "Miscellaneous",
};

export function isInvestigationStackKind(v: string): v is InvestigationStackKind {
  return (INVESTIGATION_STACK_KINDS as readonly string[]).includes(v);
}
