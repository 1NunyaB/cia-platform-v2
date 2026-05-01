import {
  abbrevLegalMilestoneAction,
  legacyArraysFromPeople,
  parseCaseIncidents,
  parseLegalMilestones,
  resolvedCasePeople,
} from "@/lib/case-directory";
import type { CaseRow } from "@/types";

/** One-line summary of structured incident fields for lists and case headers. */
export function CaseRecordMetaLine({ caseRow }: { caseRow: CaseRow }) {
  const parts: string[] = [];
  if (caseRow.investigation_started_at) {
    parts.push(caseRow.investigation_on_hold_at ? "On hold" : "Started");
  } else {
    parts.push("Created");
  }

  const incidents = parseCaseIncidents(caseRow.incidents);
  if (incidents.length > 0) {
    const locBits = incidents
      .slice(0, 2)
      .map((i) => [i.city, i.state].filter(Boolean).join(", "))
      .filter(Boolean);
    if (locBits.length) parts.push(locBits.join(" · "));
    const years = [...new Set(incidents.map((i) => i.year).filter((y): y is number => y != null))];
    if (years.length) parts.push(years.map(String).join("/"));
  } else {
    if (caseRow.incident_year != null) parts.push(String(caseRow.incident_year));
    if (caseRow.incident_city?.trim()) parts.push(caseRow.incident_city.trim());
    if (caseRow.incident_state?.trim()) parts.push(caseRow.incident_state.trim());
  }

  const { case_victims: victims, case_accused: accused } = legacyArraysFromPeople(resolvedCasePeople(caseRow));
  if (accused.length) {
    const a = accused.slice(0, 2).join(", ");
    parts.push(accused.length > 2 ? `Accused: ${a}…` : `Accused: ${a}`);
  } else if (caseRow.accused_label?.trim()) {
    parts.push(`Accused: ${caseRow.accused_label.trim()}`);
  }

  if (victims.length) {
    const v = victims.slice(0, 2).join(", ");
    parts.push(victims.length > 2 ? `Victims: ${v}…` : `Victims: ${v}`);
  } else if (caseRow.victim_labels?.trim()) {
    parts.push(`Victims: ${caseRow.victim_labels.trim()}`);
  }

  if (caseRow.charges?.trim()) {
    const ch = caseRow.charges.trim();
    parts.push(ch.length > 80 ? `Charges: ${ch.slice(0, 77)}…` : `Charges: ${ch}`);
  }

  const milestones = parseLegalMilestones(caseRow.legal_milestones);
  if (milestones.length) {
    const mbits = milestones.slice(0, 3).map((m) => `${abbrevLegalMilestoneAction(m.type)} ${m.month_year}`);
    parts.push(mbits.join(" · "));
  } else {
    if (caseRow.indictment_month_year?.trim()) parts.push(`Indicted: ${caseRow.indictment_month_year.trim()}`);
    if (caseRow.conviction_month_year?.trim()) parts.push(`Convicted: ${caseRow.conviction_month_year.trim()}`);
    if (caseRow.sentence?.trim() && caseRow.conviction_month_year?.trim()) {
      const s = caseRow.sentence.trim();
      parts.push(s.length > 60 ? `Sentence: ${s.slice(0, 57)}…` : `Sentence: ${s}`);
    }
  }

  if (parts.length === 0) return null;
  return (
    <p className="mt-2 line-clamp-2 text-sm font-medium text-slate-400">{parts.join(" · ")}</p>
  );
}
