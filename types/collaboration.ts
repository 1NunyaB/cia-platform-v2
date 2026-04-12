export type CaseNoteVisibility = "private" | "shared_case" | "public_case";

export const CASE_NOTE_VISIBILITY_LABELS: Record<CaseNoteVisibility, string> = {
  private: "Private (only you)",
  shared_case: "Shared with case members",
  public_case: "Public (visible with this public case)",
};
