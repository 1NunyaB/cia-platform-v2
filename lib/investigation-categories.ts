import { z } from "zod";
import type { InvestigationCategorySlug } from "@/types/analysis";

/** DB / API slug — `investigation_category` enum in Postgres */
export const INVESTIGATION_CATEGORY_SLUGS = [
  "core_actors",
  "money",
  "political",
  "tech",
  "intel",
  "convicted",
  "accusers",
  "accused",
  "victims",
  "dead",
] as const satisfies readonly InvestigationCategorySlug[];

export const investigationCategorySlugSchema = z.enum(INVESTIGATION_CATEGORY_SLUGS);

/** Human labels for UI badges */
export const INVESTIGATION_CATEGORY_LABELS: Record<InvestigationCategorySlug, string> = {
  core_actors: "Core Actors",
  money: "Money",
  political: "Political",
  tech: "Tech",
  intel: "Intel",
  convicted: "Convicted",
  accusers: "Accusers",
  accused: "Accused",
  dead: "Dead",
};

/** Map model output (may use slug or loose label) to canonical slug; invalid entries dropped */
export function normalizeCategoryToken(raw: string): InvestigationCategorySlug | null {
  const t = raw.trim().toLowerCase().replace(/\s+/g, "_");
  const aliases: Record<string, InvestigationCategorySlug> = {
    core_actors: "core_actors",
    coreactors: "core_actors",
    "core actors": "core_actors",
    money: "money",
    political: "political",
    tech: "tech",
    intel: "intel",
    convicted: "convicted",
    accusers: "accusers",
    accused: "accused",
    victims: "victims",
    victim: "victims",
    dead: "dead",
  };
  if (aliases[t]) return aliases[t];
  if ((INVESTIGATION_CATEGORY_SLUGS as readonly string[]).includes(t)) return t as InvestigationCategorySlug;
  return null;
}
