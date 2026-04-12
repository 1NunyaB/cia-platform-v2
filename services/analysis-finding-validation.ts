import type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";
import { DEFAULT_ANALYSIS_CONTEXT } from "@/lib/analysis-priority-doctrine";
import { supplementalTimelineIsEntirelyContextualInference } from "@/lib/contextual-time-inference";
import {
  findingTouchesPersonIdentity,
  IDENTITY_FOLLOWUP_NEXT_STEP_SNIPPET,
  needsIdentityFollowupPrompt,
} from "@/lib/identity-verification-policy";
import type {
  AnalysisClassification,
  AnalysisConfidence,
  AnalysisSupplemental,
  AuthenticityLabel,
  ConcealedLanguageAnalysisDetail,
  MediaAnalysisDetail,
  StructuredFinding,
  TimelineTier,
} from "@/types/analysis";
import { TIMESTAMP_DATE_STRENGTH_LABELS } from "@/types/analysis";

export type { AnalysisPipelineContext } from "@/lib/analysis-priority-doctrine";

/** Language that conflicts with a “Conclusive” (direct, verifiable-only) classification. */
const INFERENCE_OR_UNCERTAINTY_PATTERN =
  /\b(infer|inferred|inference|reconstruct|reconstructed|suspect|suspicion|likely|probably|possibly|may\b|might|appears|seems|pattern|association|speculat|assum|uncertain|unclear|if\s+true)\b/i;

/** Claims that imply exact recovery of redacted content — never compatible with Conclusive or Confirmed-as-literal. */
const REDACTION_RECOVERY_CLAIM_PATTERN =
  /\b(exact(ly)? recovered (from )?redact|verbatim redacted|full(y)? restored redacted|complete recovery of redacted|(the|we) (now )?know (the|what) (was )?redact|hidden text (is|says|reads)|original (hidden|redacted) (word|words|name|text)(s)? (is|was|reads|says)|recovered the (redact|blackout))\b/i;

/** Passages where redaction/withholding is materially present — Conclusive needs separate unredacted support. */
const REDACTION_MATERIAL_SIGNAL =
  /\b(redact|redacted|\[REDACTED\]|black(?:ed)?\s*out|withheld|excised|placeholder|\*{3,}|█{2,}|redaction(s)?)\b/i;

/** Explicit appeal to a separate unredacted or fully visible source (not guessing hidden text). */
const SEPARATE_UNREDACTED_SUPPORT =
  /\b(unredacted (version|copy|exhibit|attachment|email|record|source|page|lines?)|verbatim (on|in) (the )?(unredacted|public|full)[\w\s]{0,40}|separate(ly)? (filed|published|posted|provided) (unredacted|in full)|visible (in|on) (the )?(same )?(unredacted|clear))\b/i;

/** Confirmed must not rest primarily on assumption-style reasoning. */
const ASSUMPTION_OR_SPECULATION_PATTERN =
  /\b(assume[sd]?|presumably|supposedly|it follows that|must have been|necessarily implies|purely speculative)\b/i;

const MIN_EVIDENCE_BASIS_CHARS_CONCLUSIVE = 24;
const MIN_EVIDENCE_BASIS_CHARS_WEAK = 40;
/** Priority (2) Evidence support — Confirmed needs substantive tied basis. */
const MIN_EVIDENCE_BASIS_CHARS_CONFIRMED = 32;

/** Priority (1)(3) — Confirmed must not read like proof without adequate basis. */
const OVERSTATED_ATTRIBUTION_IN_ANSWER =
  /\b(proves\s+that|definitively\s+establishes|undeniably\s+shows|certainly\s+proves|without\s+doubt|must\s+be\s+true\s+because)\b/i;

function combinedCoreFields(f: StructuredFinding): string {
  return `${f.finding_answer}\n${f.evidence_basis}\n${f.reasoning}\n${f.limitations}`;
}

function appendLimitation(f: StructuredFinding, note: string): StructuredFinding {
  const base = f.limitations.trim();
  return {
    ...f,
    limitations: base ? `${base}\n\n${note}` : note,
  };
}

/** Rough count of separable factual “signals” (clauses, cues, quotes) for Inferred eligibility. */
function countEvidenceSignals(text: string): number {
  const t = text.trim();
  if (t.length < 12) return 0;
  let score = 0;
  const clauses = t.split(/[.;]\s+/).filter((s) => s.length > 20);
  score += Math.min(clauses.length, 4);
  const cueHits = (
    t.match(
      /\b(first|second|third|additionally|also|furthermore|another|separately|in addition|meanwhile|on the other hand)\b/gi,
    ) ?? []
  ).length;
  score += Math.min(cueHits, 4);
  const shortQuotes = (t.match(/"[^"]{10,120}"/g) ?? []).length;
  score += Math.min(shortQuotes, 3);
  return Math.max(score, t.length > 100 ? 2 : 1);
}

/** Distinct evidence “types” (contact, place, document, entity) for Correlated eligibility. */
function distinctEvidenceTypeCount(text: string): number {
  const tags = new Set<string>();
  if (/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(text)) tags.add("email");
  if (/\b(?:\+?\d{1,3}[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}\b/.test(text)) tags.add("phone");
  if (/\b(street|avenue|road|boulevard|city|state|zip\s*code|address|located in)\b/i.test(text)) tags.add("location");
  if (/\b(document|pdf|memo|letter|report|attachment|exhibit|filing|record|email message)\b/i.test(text))
    tags.add("document");
  if (/\b(witness|officer|director|company|llc|inc\.|organization|person|individual)\b/i.test(text))
    tags.add("entity");
  return tags.size;
}

function clampConfidence(
  classification: AnalysisClassification,
  confidence: AnalysisConfidence,
  evidenceBasisLen: number,
): AnalysisConfidence {
  let c = confidence;

  if (classification === "Uncertain") {
    return "low";
  }

  if (classification === "Reconstructed") {
    if (c === "high") c = "low";
    if (evidenceBasisLen < MIN_EVIDENCE_BASIS_CHARS_WEAK) c = "low";
    return c;
  }

  if (classification === "Inferred" || classification === "Correlated") {
    if (c === "high") return "medium";
    return c;
  }

  if (classification === "Confirmed" || classification === "Conclusive") {
    return c;
  }

  if (c === "high") return "medium";
  return c;
}

/**
 * Aligns confidence with classification rules:
 * - high: only Confirmed or Conclusive
 * - medium: typical cap for Inferred / Correlated; Reconstructed may be medium only if not weak
 * - low: Uncertain; weak Reconstructed
 */
export function alignConfidenceWithClassification(finding: StructuredFinding): StructuredFinding {
  const basisLen = finding.evidence_basis.trim().length;
  let next = clampConfidence(finding.classification, finding.confidence, basisLen);

  if (
    next === "high" &&
    finding.classification !== "Confirmed" &&
    finding.classification !== "Conclusive"
  ) {
    next = "medium";
  }
  if (
    (finding.classification === "Uncertain" || finding.classification === "Reconstructed") &&
    next === "high"
  ) {
    next = "low";
  }

  if (next === finding.confidence) return finding;

  return appendLimitation(
    { ...finding, confidence: next },
    `[Confidence adjusted automatically] Confidence was aligned with classification (${finding.classification}) and evidence strength (priority: conservative interpretation).`,
  );
}

/**
 * Priority 2 — Evidence support: Confirmed requires a substantive evidence_basis tied to the extract.
 */
function downgradeIfWeakEvidenceSupportForConfirmed(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Confirmed") return finding;
  const basisLen = finding.evidence_basis.trim().length;
  if (basisLen >= MIN_EVIDENCE_BASIS_CHARS_CONFIRMED) return finding;

  const next: AnalysisClassification = basisLen >= 14 ? "Inferred" : "Uncertain";
  return appendLimitation(
    { ...finding, classification: next },
    "[Priority: evidence support] evidence_basis was not substantive enough for Confirmed; classification lowered and confidence will be aligned.",
  );
}

/**
 * Priority (1)(3) — Avoid “proof” language in finding_answer when classification is Confirmed but basis is not long enough to carry it.
 */
function downgradeConfirmedIfOverstatedAnswer(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Confirmed") return finding;
  const answer = finding.finding_answer.trim();
  const basisLen = finding.evidence_basis.trim().length;
  if (!OVERSTATED_ATTRIBUTION_IN_ANSWER.test(answer)) return finding;
  if (basisLen >= 72) return finding;

  return appendLimitation(
    {
      ...finding,
      classification: "Inferred",
    },
    "[Priority: accuracy] finding_answer used proof-style wording without enough evidence_basis to support Confirmed; downgraded to Inferred.",
  );
}

/** Confirmed: must not imply that hidden/redacted wording is known with literal precision. */
function downgradeConfirmedIfRedactionRecoveryLanguage(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Confirmed") return finding;
  const combined = combinedCoreFields(finding);
  if (!REDACTION_RECOVERY_CLAIM_PATTERN.test(combined)) return finding;

  return appendLimitation(
    {
      ...finding,
      classification: "Inferred",
    },
    "[Priority: redaction] Confirmed requires visible or separately corroborated unredacted support; wording suggested knowledge of withheld text — downgraded to Inferred.",
  );
}

/**
 * Conclusive: only if unredacted/direct/verifiable; otherwise downgrade to Confirmed, Inferred, or Uncertain.
 */
function downgradeConclusiveIfInvalid(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Conclusive") return finding;

  const basis = finding.evidence_basis.trim();
  const combined = combinedCoreFields(finding);
  const reasons: string[] = [];

  if (finding.confidence !== "high") {
    reasons.push("Conclusive requires confidence: high.");
  }
  if (basis.length < MIN_EVIDENCE_BASIS_CHARS_CONCLUSIVE) {
    reasons.push(
      `Conclusive requires a substantive evidence_basis (at least ${MIN_EVIDENCE_BASIS_CHARS_CONCLUSIVE} characters).`,
    );
  }
  if (INFERENCE_OR_UNCERTAINTY_PATTERN.test(combined)) {
    reasons.push("Conclusive disallows inference-, pattern-, or reconstruction-style language in core fields.");
  }
  if (REDACTION_RECOVERY_CLAIM_PATTERN.test(combined)) {
    reasons.push("Conclusive disallows claims of recovering redacted text.");
  }
  if (REDACTION_MATERIAL_SIGNAL.test(combined) && !SEPARATE_UNREDACTED_SUPPORT.test(combined)) {
    reasons.push(
      "Conclusive cannot rest primarily on redacted or withheld spans; tie claims to clearly unredacted text or describe a separate unredacted source.",
    );
  }

  if (reasons.length === 0) return finding;

  let next: AnalysisClassification;
  if (REDACTION_RECOVERY_CLAIM_PATTERN.test(combined) || basis.length < 12) {
    next = "Uncertain";
  } else if (REDACTION_MATERIAL_SIGNAL.test(combined) && !SEPARATE_UNREDACTED_SUPPORT.test(combined)) {
    next = "Correlated";
  } else if (INFERENCE_OR_UNCERTAINTY_PATTERN.test(combined)) {
    next = "Inferred";
  } else if (basis.length >= MIN_EVIDENCE_BASIS_CHARS_CONCLUSIVE) {
    next = "Confirmed";
  } else {
    next = "Uncertain";
  }

  const addendum = `[Classification adjusted automatically] Conclusive was not warranted (${reasons.join(" ")}). Applied conservative label: ${next}.`;

  return appendLimitation(
    {
      ...finding,
      classification: next,
    },
    addendum,
  );
}

/** Confirmed: no primary reliance on assumption-style leaps. */
function downgradeConfirmedIfAssumptive(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Confirmed") return finding;
  const combined = combinedCoreFields(finding);
  if (!ASSUMPTION_OR_SPECULATION_PATTERN.test(combined)) return finding;

  return appendLimitation(
    {
      ...finding,
      classification: "Inferred",
    },
    "[Classification adjusted automatically] Confirmed requires direct support without assumption-led reasoning; downgraded to Inferred.",
  );
}

/** Inferred: needs at least two supporting signals in core text. */
function downgradeInferredIfThin(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Inferred") return finding;
  const combined = combinedCoreFields(finding);
  if (countEvidenceSignals(combined) >= 2) return finding;

  return appendLimitation(
    {
      ...finding,
      classification: "Uncertain",
    },
    "[Classification adjusted automatically] Inferred requires at least two separable supporting signals; evidence was treated as too thin — downgraded to Uncertain.",
  );
}

/** Correlated: needs multiple evidence types (not a single-source story). */
function downgradeCorrelatedIfSingleTrack(finding: StructuredFinding): StructuredFinding {
  if (finding.classification !== "Correlated") return finding;
  const combined = combinedCoreFields(finding);
  if (distinctEvidenceTypeCount(combined) >= 2) return finding;

  const next: AnalysisClassification =
    countEvidenceSignals(combined) >= 2 ? "Inferred" : "Uncertain";

  return appendLimitation(
    {
      ...finding,
      classification: next,
    },
    `[Classification adjusted automatically] Correlated requires multiple evidence types (e.g. contact, location, document, entity); downgraded to ${next}.`,
  );
}

/**
 * Priority 6 — Actionable next_step: concrete verbs, limitations-aware, scoped to analysis type.
 */
function ensureActionableNextStep(
  finding: StructuredFinding,
  ctx: AnalysisPipelineContext,
): StructuredFinding {
  let ns = finding.next_step.trim();
  const lim = finding.limitations.trim();

  const hasConcreteVerb =
    ns.length >= 40 &&
    /\b(obtain|acquire|review|compare|verify|reconcile|cross[- ]?check|extract|ocr|request|upload|add|file|interview|subpoena|trace|validate|canvass)\b/i.test(
      ns,
    );

  if (hasConcreteVerb && ns.length >= 55) {
    if (
      ctx.scope === "evidence_cluster" &&
      !/\bcluster|members?|files?\b/i.test(ns) &&
      !ns.includes("(Cluster: validate the same signals")
    ) {
      ns = `${ns} (Cluster: validate the same signals across each listed file before raising certainty.)`;
    } else if (
      ctx.scope === "case_investigation" &&
      ctx.caseAction &&
      !ns.toLowerCase().includes(ctx.caseAction.replace(/_/g, " ")) &&
      !ns.includes("(Case review: align follow-up")
    ) {
      ns = `${ns} (Case review: align follow-up with “${ctx.caseAction.replace(/_/g, " ")}” and cross-file checks.)`;
    }
    return { ...finding, next_step: ns.slice(0, 2000) };
  }

  const limFrag =
    lim.length > 24
      ? ` Given current limitations (${lim.slice(0, 200)}${lim.length > 200 ? "…" : ""})`
      : "";

  const scopeBlock =
    ctx.scope === "evidence_cluster"
      ? " Next: compare extracts cluster-wide for shared entities, dates, locations, and explicit contradictions; add files only when content supports the same linkage."
      : ctx.scope === "case_investigation"
        ? ` Next: prioritize actions that reduce ambiguity for this case review (${(ctx.caseAction ?? "selected analysis").replace(/_/g, " ")}), using multiple evidence files where possible.`
        : " Next: improve extraction/OCR if the text is thin, then cross-check names, dates, and institutions against other case evidence before treating claims as confirmed.";

  const scopeFingerprint =
    ctx.scope === "evidence_cluster"
      ? "compare extracts cluster-wide for shared entities"
      : ctx.scope === "case_investigation"
        ? "prioritize actions that reduce ambiguity for this case review"
        : "cross-check names, dates, and institutions";

  if (ns.includes(scopeFingerprint.slice(0, 24))) {
    return { ...finding, next_step: ns.slice(0, 2000) };
  }

  const merged = `${ns ? `${ns} ` : ""}${limFrag}${scopeBlock}`.trim().replace(/\s+/g, " ");
  return { ...finding, next_step: merged.slice(0, 2000) };
}

/**
 * Full pipeline: strict priority order (accuracy → evidence support → conservative labels → clarity via limitations)
 * + confidence alignment + actionable next_step. Call after `normalizeStructuredFinding` on any persisted or displayed finding.
 */
/**
 * Whether a resolved timeline tier is compatible with the analysis classification (used for QA / docs).
 * Authoritative tier assignment is `resolveTimelineTier` in lib/timeline-tier.ts.
 */
export function timelineTierCompatibleWithClassification(
  tier: TimelineTier,
  classification: AnalysisClassification,
): boolean {
  if (tier === "t1_confirmed") {
    return classification === "Confirmed" || classification === "Conclusive";
  }
  if (tier === "t2_supported") {
    return ["Confirmed", "Inferred", "Correlated", "Conclusive"].includes(classification);
  }
  return true;
}

/** Map authenticity label to a conservative confidence cap (independent from classification). */
function clampConfidenceForAuthenticity(
  c: AnalysisConfidence,
  label: AuthenticityLabel,
): AnalysisConfidence {
  switch (label) {
    case "potentially_manipulated":
      return "low";
    case "inconsistent":
      if (c === "high") return "medium";
      if (c === "medium") return "low";
      return c;
    case "unverified":
      if (c === "high") return "medium";
      return c;
    case "likely_authentic":
      if (c === "high") return "medium";
      return c;
    default:
      return c;
  }
}

/**
 * Authenticity is independent from classification. Adjusts confidence, may downgrade classification,
 * and expands limitations / next_step when integrity is in doubt.
 */
export function enforceAuthenticityDiscipline(
  finding: StructuredFinding,
  label: AuthenticityLabel,
  notes?: string,
): StructuredFinding {
  let f = finding;
  const nextConf = clampConfidenceForAuthenticity(f.confidence, label);
  if (nextConf !== f.confidence) {
    f = appendLimitation(
      { ...f, confidence: nextConf },
      `[Authenticity] Label "${label}": confidence reduced — authenticity and analytical classification are evaluated separately.`,
    );
  }

  if (label === "unverified") {
    if (!/\b(authenticity|provenance|unverified|chain of custody)\b/i.test(f.limitations)) {
      f = appendLimitation(
        f,
        "[Authenticity] This material has not been independently authenticated; verify provenance before relying on it.",
      );
    }
  }

  if (label === "potentially_manipulated") {
    if (f.classification === "Conclusive" || f.classification === "Confirmed") {
      f = appendLimitation(
        { ...f, classification: "Inferred" },
        "[Authenticity] Potentially manipulated or integrity concerns — Confirmed/Conclusive are not appropriate; downgraded to Inferred.",
      );
    }
    const forensic =
      "Verify chain of custody, original source, file metadata, and consider forensic analysis or an independent unaltered copy.";
    if (!/\b(provenance|metadata|forensic|chain of custody)\b/i.test(f.next_step)) {
      f = { ...f, next_step: `${f.next_step.trim()}\n\n${forensic}`.slice(0, 2000) };
    }
  } else if (label === "inconsistent") {
    if (f.classification === "Conclusive" || f.classification === "Confirmed") {
      f = appendLimitation(
        { ...f, classification: "Correlated" },
        "[Authenticity] Inconsistent material — Confirmed/Conclusive downgraded to Correlated until reconciled with other evidence.",
      );
    }
  }

  if (notes && notes.trim().length > 0 && (label === "potentially_manipulated" || label === "inconsistent")) {
    const frag = notes.trim().slice(0, 800);
    if (!f.limitations.includes(frag.slice(0, 60))) {
      f = appendLimitation(f, `[Authenticity evaluation] ${frag}`);
    }
  }

  return f;
}

/** Wording that treats coded / hidden meaning as definitively established — not allowed at Confirmed/Conclusive. */
const DEFINITIVE_CODE_OR_HIDDEN_CLAIM = /\b(the\s+)?(hidden|code(d)?|coded)\s+(meaning|message)\s+(is|was|equals|means)\b|\b(proves?|proved|definitively\s+(establish|proves))[^\n]{0,160}\b(code|cipher|slang|euphemism|hidden\s+meaning)\b/i;

/** Core fields discuss concealed-language subject matter (not every Conclusive finding). */
function touchesConcealedLanguageTopic(f: StructuredFinding): boolean {
  const t = `${f.finding_answer}\n${f.reasoning}\n${f.evidence_basis}`;
  return /\b(code|coded|euphemism|cipher|slang|non[- ]literal|hidden meaning|substitution|double meaning|veiled)\b/i.test(
    t,
  );
}

/**
 * Conservative caps when optional `concealed_language_analysis` is present: no Conclusive for coded interpretation,
 * block definitive “proof” wording, and cap confidence when signals are weak.
 */
export function enforceConcealedLanguageDiscipline(
  finding: StructuredFinding,
  concealed: ConcealedLanguageAnalysisDetail | null,
): StructuredFinding {
  let f = finding;
  const combined = `${f.finding_answer}\n${f.reasoning}\n${f.evidence_basis}`;

  if (DEFINITIVE_CODE_OR_HIDDEN_CLAIM.test(combined)) {
    if (f.classification === "Conclusive") {
      f = appendLimitation(
        { ...f, classification: "Correlated" },
        "[Concealed language] Definitive coded/hidden-meaning wording is not supported at Conclusive; lowered to Correlated.",
      );
    } else if (f.classification === "Confirmed") {
      f = appendLimitation(
        { ...f, classification: "Inferred" },
        "[Concealed language] Definitive coded/hidden-meaning wording is not supported at Confirmed; lowered to Inferred.",
      );
    }
  }

  if (!concealed || concealed.flagged_phrases.length === 0) {
    return f;
  }

  if (
    f.classification === "Conclusive" &&
    touchesConcealedLanguageTopic(f) &&
    concealed.flagged_phrases.length > 0
  ) {
    f = appendLimitation(
      { ...f, classification: "Correlated" },
      "[Concealed language] Conclusive is not used when the finding turns on possible non-literal or coded phrasing; lowered to Correlated pending direct verifiable support in plain text.",
    );
  }

  const onlyWeakSignals = concealed.flagged_phrases.every(
    (p) => p.usage_strength === "ordinary_likely" || p.usage_strength === "isolated_unusual",
  );
  if (onlyWeakSignals && touchesConcealedLanguageTopic(f) && f.confidence === "high") {
    f = appendLimitation(
      { ...f, confidence: "medium" },
      "[Concealed language] Confidence reduced while flagged usage is ordinary-likely or isolated only.",
    );
  }

  if (!/\[Concealed language\] Possible euphemisms/.test(f.limitations)) {
    f = appendLimitation(
      f,
      "[Concealed language] Possible euphemisms or coded usage are hypotheses — verify with additional case evidence; do not treat as proven hidden meanings without corroboration.",
    );
  }

  return f;
}

/** Treating correlation as definitive proof — incompatible with Confirmed/Conclusive wording. */
const CORRELATION_AS_PROOF =
  /\b(correlation|link(age)?|overlap|pattern\s+similarity)\s+(proves?|establishes|confirms|demonstrates)\b|\bproves?\s+(the\s+)?(correlation|link|connection|relationship)\b|\bdefinitively\s+(linked|connected|correlated)\b/i;

const REPETITION_ALONE_PROVES = /\brepetition\s+(alone|by\s+itself)\s+(proves|shows|establishes|confirms)\b/i;

/**
 * Blocks overstated “search/correlation proves X” claims; keeps correlation hypotheses conservative.
 */
/**
 * Prevents overstated identity conclusions from nickname/alias similarity alone (seven-field output unchanged in shape).
 */
export function enforceAliasDiscipline(finding: StructuredFinding): StructuredFinding {
  let f = finding;
  const blob = `${f.finding_answer}\n${f.reasoning}\n${f.evidence_basis}\n${f.limitations}`;

  const weakNameSimilarity =
    /\b(similar name|spelling (?:variant|variation)|could be the same|possibly the same|shares a name|homonym|common name)\b/i.test(
      blob,
    );
  if (weakNameSimilarity && (f.classification === "Confirmed" || f.classification === "Conclusive")) {
    f = appendLimitation(
      { ...f, classification: "Uncertain" },
      "[Alias] Weak or ambiguous name similarity cannot support Confirmed/Conclusive; classification capped at Uncertain until documentary identity linkage exists.",
    );
  }

  const aliasWithoutProof =
    /\b(aka|a\.k\.a\.|nickname|alias|also known as|nicknamed)\b/i.test(blob) &&
    /\b(same person|same individual|proves identity|identity confirmed|definitively the same)\b/i.test(blob) &&
    !/\b(named in|signed|passport|license|id card|verbatim|explicitly states)\b/i.test(blob);

  if (aliasWithoutProof && (f.classification === "Conclusive" || f.classification === "Confirmed")) {
    f = appendLimitation(
      { ...f, classification: f.classification === "Conclusive" ? "Correlated" : "Inferred" },
      "[Alias] Alias or nickname language without explicit documentary linkage was treated as definitive; classification lowered — verify with named references in evidence.",
    );
  }

  return f;
}

export function enforceSearchCorrelationDiscipline(finding: StructuredFinding): StructuredFinding {
  let f = finding;
  const combined = `${f.finding_answer}\n${f.reasoning}\n${f.evidence_basis}`;

  if (CORRELATION_AS_PROOF.test(combined)) {
    if (f.classification === "Conclusive") {
      f = appendLimitation(
        { ...f, classification: "Correlated" },
        "[Search/correlation] Correlation or linkage language was treated as definitive proof; classification lowered — correlation supports inquiry but is not proof by itself.",
      );
    } else if (f.classification === "Confirmed") {
      f = appendLimitation(
        { ...f, classification: "Inferred" },
        "[Search/correlation] Correlation-style linkage was overstated as Confirmed; lowered to Inferred pending direct verifiable support.",
      );
    }
  }

  if (REPETITION_ALONE_PROVES.test(combined)) {
    f = appendLimitation(
      f,
      "[Search/correlation] Repetition without supporting context does not establish linkage; keep strength weak unless independent cues align.",
    );
  }

  const equivocatesTimeTiers =
    /\b(same\s+as\s+an?\s+exact\s+timestamp|within\s+12\s*h(?:ours)?\s+is\s+(the\s+)?same\s+as\s+exact|same\s+date\s+(proves|equals)\s+same\s+moment)\b/i;
  if (equivocatesTimeTiers.test(combined)) {
    f = appendLimitation(
      f,
      "[Search/correlation] Time-alignment tiers must stay distinct: exact same-moment / verifiable timestamp ≠ within-12-hour proximity ≠ same calendar date only.",
    );
  }

  return f;
}

export function validateTimelineContextualMetadata(supplemental: AnalysisSupplemental): string[] {
  const issues: string[] = [];
  const rows = supplemental.timeline ?? [];
  for (let i = 0; i < rows.length; i++) {
    const ev = rows[i];
    if (ev.timing_basis === "contextual_inference" && !ev.contextual_time_inference) {
      issues.push(
        `timeline[${i}]: timing_basis is contextual_inference but contextual_time_inference is missing`,
      );
    }
  }
  return issues;
}

/**
 * When `media_analysis` is present: time-alignment notes, strict identity verification (named-in-evidence rules),
 * and optional user follow-up text in `next_step`. Does not replace the seven core fields — may downgrade classification.
 */
export function enforceMediaFindingDiscipline(
  finding: StructuredFinding,
  media: MediaAnalysisDetail | null,
): StructuredFinding {
  if (!media) return finding;
  let f = finding;

  const touchesIdentity = findingTouchesPersonIdentity(f.finding_answer, f.evidence_basis);

  const explicitlyNamedInTextLayers =
    media.identity_basis === "named_in_evidence" ||
    media.identity_basis === "transcript_caption_or_metadata_named" ||
    (media.identity_basis === "mixed" && media.identity_claim_kind === "named_identity");

  if (touchesIdentity && f.classification === "Conclusive") {
    const conclusiveIdentityAllowed =
      explicitlyNamedInTextLayers && media.identity_certainty === "high";
    if (!conclusiveIdentityAllowed) {
      f = appendLimitation(
        { ...f, classification: "Inferred" },
        "[Identity verification] Conclusive identity requires an explicit name in the extract (text, transcript, captions, or metadata), strong verification, and high identity certainty; downgraded to Inferred.",
      );
    }
  }

  if (touchesIdentity && f.classification === "Confirmed") {
    const basisBlocksConfirmed =
      media.identity_basis === "visual_only" ||
      media.identity_basis === "unnamed_unknown" ||
      media.identity_claim_kind === "unknown_individual";
    if (basisBlocksConfirmed) {
      f = appendLimitation(
        { ...f, classification: "Correlated" },
        "[Identity verification] Confirmed identity requires an explicit name in evidence (including transcript, captions, or metadata where applicable), not visual-only or unnamed subjects; downgraded to Correlated.",
      );
    } else if (
      (media.identity_claim_kind === "possible_match" ||
        media.identity_claim_kind === "visual_similarity" ||
        media.identity_claim_kind === "inferred_match") &&
      !explicitlyNamedInTextLayers
    ) {
      f = appendLimitation(
        { ...f, classification: "Inferred" },
        "[Identity verification] Possible or inferred identity match is not Confirmed without explicit naming in text layers; downgraded to Inferred.",
      );
    }
  }

  const ts = media.timestamp_date_strength;
  if (ts !== "exact_match" && ts !== "none") {
    const label = TIMESTAMP_DATE_STRENGTH_LABELS[ts];
    if (!/\[Time alignment\]/i.test(f.limitations)) {
      f = appendLimitation(
        f,
        `[Time alignment] Recorded strength: ${label}. This is not interchangeable with an exact same-moment timestamp match.`,
      );
    }
  }

  return f;
}

/**
 * Appends the identity follow-up prompt after other next_step shaping (see `enforceFindingDiscipline`).
 */
export function finalizeMediaIdentityFollowup(
  finding: StructuredFinding,
  media: MediaAnalysisDetail | null,
): StructuredFinding {
  if (!media || !needsIdentityFollowupPrompt(media)) return finding;
  if (finding.next_step.includes("Would you like to search for a possible match")) return finding;
  const merged = `${finding.next_step.trim()}\n\n${IDENTITY_FOLLOWUP_NEXT_STEP_SNIPPET}`.trim();
  return { ...finding, next_step: merged.slice(0, 2000) };
}

export function downgradeConclusiveIfTimelineEntirelyContextualInference(
  finding: StructuredFinding,
  supplemental: AnalysisSupplemental,
): StructuredFinding {
  if (finding.classification !== "Conclusive") return finding;
  if (!supplementalTimelineIsEntirelyContextualInference(supplemental)) return finding;

  return appendLimitation(
    { ...finding, classification: "Correlated" },
    "[Priority: contextual time] Conclusive is not allowed when every timeline row relies solely on contextual time inference (holidays, public or media events, cross-evidence alignment) without documentary dates in the extract; classification lowered to Correlated.",
  );
}

export function enforceFindingDiscipline(
  finding: StructuredFinding,
  context?: AnalysisPipelineContext,
): StructuredFinding {
  const ctx: AnalysisPipelineContext = { ...DEFAULT_ANALYSIS_CONTEXT, ...context };
  let f = finding;
  f = downgradeIfWeakEvidenceSupportForConfirmed(f);
  f = downgradeConfirmedIfOverstatedAnswer(f);
  f = downgradeConfirmedIfRedactionRecoveryLanguage(f);
  f = downgradeConclusiveIfInvalid(f);
  f = downgradeConfirmedIfAssumptive(f);
  f = downgradeCorrelatedIfSingleTrack(f);
  f = downgradeInferredIfThin(f);
  f = alignConfidenceWithClassification(f);
  f = ensureActionableNextStep(f, ctx);
  return f;
}

/** @deprecated Use `enforceFindingDiscipline` — alias kept for older imports. */
export function enforceConclusiveRules(
  finding: StructuredFinding,
  context?: AnalysisPipelineContext,
): StructuredFinding {
  return enforceFindingDiscipline(finding, context);
}
