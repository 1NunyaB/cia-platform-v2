"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";

/** First segment after `/cases/` when it looks like a case id (not `new` or other routes). */
const CASE_ID_SEGMENT =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

function caseIdFromPathname(pathname: string | null): string | null {
  if (!pathname?.startsWith("/cases/")) return null;
  const first = pathname.slice("/cases/".length).split("/").find(Boolean);
  if (!first || first === "new" || !CASE_ID_SEGMENT.test(first)) return null;
  return first;
}

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const caseId = useMemo(() => caseIdFromPathname(pathname), [pathname]);
  const backHref = caseId ? `/cases/${caseId}` : "/cases";

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-6 text-foreground">
      <div className="max-w-lg space-y-4 text-center">
        <h2 className="text-2xl font-semibold">Something went wrong</h2>
        <p className="text-sm text-muted-foreground">
          The page hit an error. Try refreshing or resetting the view.
        </p>
        {error.message ? (
          <p className="break-words rounded-md border border-border bg-card px-3 py-2 font-mono text-xs text-foreground">
            {error.message}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => reset()}
            className="border-border text-foreground hover:bg-muted"
          >
            Try again
          </Button>
          <Button
            asChild
            variant="outline"
            className="border-border text-foreground hover:bg-muted"
          >
            <Link href={backHref}>Back to case</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
