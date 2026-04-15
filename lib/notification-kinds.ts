/**
 * `user_notifications.kind` values — keep stable for filtering and UI.
 */
export const NOTIFICATION_KIND = {
  /** @deprecated prefer CASE_HELP_REQUESTED; kept for existing rows */
  CASE_ASSISTANCE_REQUESTED: "case_assistance_requested",
  CASE_STARTED: "case_started",
  CASE_HELP_REQUESTED: "case_help_requested",
  INVESTIGATOR_JOINED: "investigator_joined",
  INVESTIGATOR_AWAY: "investigator_away",
  EVIDENCE_ADDED: "evidence_added",
  NOTE_ADDED: "note_added",
  STATUS_CHANGED: "status_changed",
  EVIDENCE_SHARE_PROPOSAL: "evidence_share_proposal",
} as const;

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];

/** Kinds that trigger urgent bell / flash until acknowledged. */
export const HIGH_PRIORITY_NOTIFICATION_KINDS = new Set<string>([
  NOTIFICATION_KIND.CASE_ASSISTANCE_REQUESTED,
  NOTIFICATION_KIND.CASE_HELP_REQUESTED,
  NOTIFICATION_KIND.CASE_STARTED,
  NOTIFICATION_KIND.EVIDENCE_SHARE_PROPOSAL,
  NOTIFICATION_KIND.STATUS_CHANGED,
  "high_priority_alert",
  "chat_mute",
]);
