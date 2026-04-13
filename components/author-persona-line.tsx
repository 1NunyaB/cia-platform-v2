import type { ProfileWithInvestigator } from "@/lib/profiles";

/** Uses opt-in investigator alias/avatar when configured; otherwise display name or id. */
export function AuthorPersonaLine({
  profile,
  fallbackId,
  size = "sm",
}: {
  profile?: ProfileWithInvestigator | null;
  fallbackId?: string | null;
  size?: "sm" | "md";
}) {
  const optIn = profile?.investigator_opt_in === true;
  const alias = profile?.investigator_alias?.trim();
  const avatar = profile?.investigator_avatar_url?.trim();
  const showPersona = Boolean(optIn && alias);
  const label = showPersona ? alias! : profile?.display_name?.trim() || fallbackId || "Analyst";
  const imgClass = size === "md" ? "h-8 w-8" : "h-5 w-5";
  return (
    <span className="inline-flex items-center gap-1.5 min-w-0 max-w-full">
      {showPersona && avatar ? (
        <img
          src={avatar}
          alt=""
          className={`${imgClass} shrink-0 rounded-full border border-border object-cover`}
        />
      ) : null}
      <span className="truncate text-foreground">{label}</span>
    </span>
  );
}
