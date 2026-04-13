export const EXTRACTION_REMINDER_EVENT = "cia:extraction-reminder";

export type ExtractionReminderDetail = {
  evidenceId: string;
  filename: string;
  href: string;
  /** When the upload targeted a case, scope the auto-note to that investigation. */
  caseId?: string | null;
};

export function emitExtractionReminder(detail: ExtractionReminderDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EXTRACTION_REMINDER_EVENT, { detail }));
}
