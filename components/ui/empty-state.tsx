import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Consistent empty / zero-data presentation — bordered, readable contrast.
 */
export function EmptyState({
  className,
  title,
  children,
}: {
  className?: string;
  title: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border bg-muted/25 px-5 py-8 text-center shadow-none",
        className,
      )}
    >
      <p className="text-sm font-medium leading-snug text-foreground">{title}</p>
      {children ? (
        <div className="mt-2 text-sm leading-relaxed text-muted-foreground [&_a]:font-medium [&_a]:text-foreground [&_a]:underline [&_a]:decoration-2 [&_a]:underline-offset-2 [&_a]:hover:no-underline">
          {children}
        </div>
      ) : null}
    </div>
  );
}
