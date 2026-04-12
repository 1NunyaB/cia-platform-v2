import { z } from "zod";
import type { AuthenticityLabel } from "@/types/analysis";

const LABEL_SET = new Set<string>([
  "verified_by_source",
  "strongly_corroborated",
  "likely_authentic",
  "unverified",
  "inconsistent",
  "potentially_manipulated",
]);

/** Canonical slugs — use with `z.enum` after normalization. */
export const AUTHENTICITY_LABEL_SLUGS = [
  "verified_by_source",
  "strongly_corroborated",
  "likely_authentic",
  "unverified",
  "inconsistent",
  "potentially_manipulated",
] as const satisfies readonly AuthenticityLabel[];

/**
 * Zod field for model JSON: any string (or missing) → normalized slug.
 */
export const authenticityLabelZodSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => normalizeAuthenticityLabel(v));

export const authenticityOptionalNotesZodSchema = z
  .union([z.string(), z.undefined(), z.null()])
  .transform((v) => normalizeAuthenticityNotes(v));

/**
 * Coerce model output to a canonical authenticity label (independent from analytical classification).
 */
export function normalizeAuthenticityLabel(raw: unknown): AuthenticityLabel {
  const s = typeof raw === "string" ? raw.trim().toLowerCase().replace(/\s+/g, "_") : "";
  const aliases: Record<string, AuthenticityLabel> = {
    verified_by_source: "verified_by_source",
    verifiedbysource: "verified_by_source",
    verified_by_the_source: "verified_by_source",
    source_verified: "verified_by_source",
    strongly_corroborated: "strongly_corroborated",
    stronglycorroborated: "strongly_corroborated",
    likely_authentic: "likely_authentic",
    likelyauthentic: "likely_authentic",
    unverified: "unverified",
    inconsistent: "inconsistent",
    potentially_manipulated: "potentially_manipulated",
    potentiallymanipulated: "potentially_manipulated",
    potential_manipulation: "potentially_manipulated",
    suspected_manipulation: "potentially_manipulated",
    manipulated: "potentially_manipulated",
  };
  const mapped = aliases[s] ?? (LABEL_SET.has(s) ? (s as AuthenticityLabel) : null);
  return mapped ?? "unverified";
}

export function normalizeAuthenticityNotes(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const t = raw.trim();
  return t.length > 0 ? t.slice(0, 4000) : undefined;
}
