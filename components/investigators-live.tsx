"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { InvestigatorIdentityProfile, InvestigatorWallCard } from "@/lib/investigator-profile";
import { InvestigatorIdentitySettings } from "@/components/investigator-identity-settings";

function sortWall(rows: InvestigatorWallCard[]): InvestigatorWallCard[] {
  return [...rows].sort((a, b) =>
    (a.investigator_alias ?? "").localeCompare(b.investigator_alias ?? "", undefined, {
      sensitivity: "base",
    }),
  );
}

function applyWallChange(
  prev: InvestigatorWallCard[],
  userId: string,
  row: InvestigatorIdentityProfile,
): InvestigatorWallCard[] {
  const withoutMe = prev.filter((r) => r.id !== userId);
  if (!row.investigator_opt_in) {
    return sortWall(withoutMe);
  }
  const alias = row.investigator_alias?.trim() ?? "";
  if (!alias) {
    return sortWall(withoutMe);
  }
  return sortWall([
    ...withoutMe,
    {
      id: row.id,
      investigator_alias: row.investigator_alias,
      investigator_avatar_url: row.investigator_avatar_url,
      investigator_tagline: row.investigator_tagline,
    },
  ]);
}

export function InvestigatorsLive({
  userId,
  initialWall,
}: {
  userId: string | null;
  initialWall: InvestigatorWallCard[];
}) {
  const router = useRouter();
  const [wall, setWall] = useState<InvestigatorWallCard[]>(initialWall);

  useEffect(() => {
    setWall(initialWall);
  }, [initialWall]);

  const onIdentitySaved = useCallback(
    (profile: InvestigatorIdentityProfile) => {
      if (!userId) return;
      setWall((prev) => applyWallChange(prev, userId, profile));
    },
    [userId],
  );

  const onAfterPersist = useCallback(() => {
    router.refresh();
  }, [router]);

  return (
    <>
      {userId ? (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Your investigator identity</CardTitle>
            <CardDescription>
              Separate from your account display name. Nothing is published until you opt in and save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvestigatorIdentitySettings onIdentitySaved={onIdentitySaved} onAfterPersist={onAfterPersist} />
          </CardContent>
        </Card>
      ) : (
        <p className="text-sm text-muted-foreground">
          <Link href="/login" className="font-medium text-foreground underline underline-offset-2">
            Sign in
          </Link>{" "}
          to create an investigator identity.
        </p>
      )}

      <div>
        <h2 className="text-lg font-medium text-foreground mb-4">Wall</h2>
        {wall.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {userId
              ? "No investigators have opted in yet. Be the first after you enable your identity above."
              : "No investigators have opted in yet."}
          </p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {wall.map((r) => {
              const alias = r.investigator_alias?.trim();
              if (!alias) return null;
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-panel p-4 shadow-sm flex flex-col gap-2"
                >
                  <div className="flex items-start gap-3">
                    {r.investigator_avatar_url ? (
                      <img
                        src={r.investigator_avatar_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-full border border-border object-cover"
                      />
                    ) : (
                      <div className="h-12 w-12 shrink-0 rounded-full border border-dashed border-border bg-muted/40" />
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{alias}</p>
                      {r.investigator_tagline ? (
                        <p className="text-xs text-foreground mt-1 leading-snug">{r.investigator_tagline}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </>
  );
}
