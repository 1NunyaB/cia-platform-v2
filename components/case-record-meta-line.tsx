import type { CaseRow } from "@/types";

/** One-line summary of structured incident fields for lists and case headers. */
export function CaseRecordMetaLine({ caseRow }: { caseRow: CaseRow }) {
  const parts: string[] = [];
  if (caseRow.investigation_started_at) {
    parts.push(caseRow.investigation_on_hold_at ? "On hold" : "Started");
  } else {
    parts.push("Created");
  }
  if (caseRow.incident_year != null) parts.push(String(caseRow.incident_year));
  if (caseRow.incident_city?.trim()) parts.push(caseRow.incident_city.trim());
  if (caseRow.incident_state?.trim()) parts.push(caseRow.incident_state.trim());
  if (caseRow.accused_label?.trim()) parts.push(`Accused: ${caseRow.accused_label.trim()}`);
  if (caseRow.victim_labels?.trim()) parts.push(`Victims: ${caseRow.victim_labels.trim()}`);
  if (caseRow.known_weapon?.trim()) parts.push(`Weapon: ${caseRow.known_weapon.trim()}`);
  if (parts.length === 0) return null;
  return (
    <p className="text-xs text-foreground font-medium line-clamp-2 mt-1">{parts.join(" · ")}</p>
  );
}
