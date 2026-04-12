/**
 * Stable display filenames (stem__NNN) and short aliases (ReadableName + sequence).
 * Aliases are minted once at upload; graph changes do not rename them (see DB columns).
 */

export type AliasSeedType =
  | "cluster"
  | "entity"
  | "location"
  | "source_program"
  | "source_platform"
  | "original_basename"
  | "generic";

export function filenameStem(filename: string): string {
  const base = filename.replace(/^.*[/\\]/, "");
  return base.replace(/\.[^/.]+$/, "") || base || "file";
}

/** Display label: preserve stem, append case-unique sequence (no extension). */
export function buildDisplayFilename(originalFilename: string, sequence: number): string {
  const stem = filenameStem(originalFilename);
  const safe = stem
    .replace(/[^\w\-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 120);
  const root = safe.length ? safe : "file";
  const n = String(sequence).padStart(3, "0");
  return `${root}__${n}`;
}

function wordsFromText(s: string): string[] {
  return s
    .split(/[\s_/.,;:()[\]'"`~\-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && /[a-zA-Z0-9]/.test(w));
}

function toAliasBaseFromWords(words: string[], maxWords = 3): string {
  const take = words.slice(0, maxWords);
  let out = "";
  for (const w of take) {
    const cap = w.charAt(0).toUpperCase() + w.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]/g, "");
    if (!cap) continue;
    out += cap;
  }
  return out.slice(0, 36);
}

/**
 * At upload time: cluster/entity/location are usually unavailable — use source, then stem, then generic.
 * (Matches priority order when only upload metadata exists.)
 */
export function deriveUploadAliasSeed(input: {
  sourceProgram: string | null;
  sourcePlatform: string | null;
  originalFilename: string;
}): { base: string; seed: string; seedType: AliasSeedType } {
  const prog = input.sourceProgram?.trim();
  if (prog && prog.length >= 2) {
    const w = wordsFromText(prog);
    const base = toAliasBaseFromWords(w.length ? w : [prog]) || "Evidence";
    return { base, seed: prog, seedType: "source_program" };
  }
  const plat = input.sourcePlatform?.trim();
  if (plat && plat.length >= 2) {
    const w = wordsFromText(plat);
    const base = toAliasBaseFromWords(w.length ? w : [plat]) || "Evidence";
    return { base, seed: plat, seedType: "source_platform" };
  }
  const stem = filenameStem(input.originalFilename);
  const w = wordsFromText(stem.replace(/[_-]+/g, " "));
  const base = toAliasBaseFromWords(w.length ? w : [stem]);
  if (base.length >= 3) {
    return { base, seed: stem, seedType: "original_basename" };
  }
  return { base: "Evidence", seed: stem || "upload", seedType: "generic" };
}

/** Final short alias: readable token + case sequence (stable, unique per case with sequence). */
export function composeShortAlias(sanitizedBase: string, sequence: number): string {
  const core = sanitizedBase.replace(/[^a-zA-Z0-9]/g, "").slice(0, 40);
  const prefix = core.length ? core : "Evidence";
  return `${prefix}${sequence}`;
}

export function evidencePrimaryLabel(row: {
  display_filename?: string | null;
  original_filename: string;
}): string {
  const d = row.display_filename?.trim();
  return d || row.original_filename;
}
