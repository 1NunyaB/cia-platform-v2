"use client";

import { cn } from "@/lib/utils";

export function InvestigationLoadingIndicator({
  label = "Investigating...",
  inline = false,
  className,
}: {
  label?: string;
  inline?: boolean;
  className?: string;
}) {
  if (inline) {
    return (
      <span className={cn("inline-flex items-center gap-2", className)}>
        <span className="cis-loader cis-loader--inline" aria-hidden />
        <span>{label}</span>
      </span>
    );
  }

  return (
    <div className={cn("flex min-h-[220px] flex-col items-center justify-center gap-3", className)} role="status" aria-live="polite">
      <span className="cis-loader" aria-hidden />
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

