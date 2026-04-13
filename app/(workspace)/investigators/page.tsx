import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { InvestigatorIdentitySettings } from "@/components/investigator-identity-settings";

export default async function InvestigatorsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: rows, error } = await supabase
    .from("profiles")
    .select("id, investigator_alias, investigator_avatar_url, investigator_tagline")
    .eq("investigator_opt_in", true)
    .not("investigator_alias", "is", null)
    .order("investigator_alias", { ascending: true });

  const wall = (error ? [] : rows ?? []) as {
    id: string;
    investigator_alias: string | null;
    investigator_avatar_url: string | null;
    investigator_tagline: string | null;
  }[];

  return (
    <div className="mx-auto w-full max-w-4xl space-y-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Investigators</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-foreground">
          Opt-in directory of workspace members who chose an investigator alias and optional avatar. Guests cannot add
          a profile here —{" "}
          <Link href="/login" className="font-medium text-primary underline underline-offset-2">
            sign in
          </Link>{" "}
          to participate.
        </p>
      </div>

      {user ? (
        <Card className="border-border shadow-sm">
          <CardHeader>
            <CardTitle className="text-base text-foreground">Your investigator identity</CardTitle>
            <CardDescription>
              Separate from your account display name. Nothing is published until you opt in and save.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvestigatorIdentitySettings />
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
            No investigators have opted in yet. Be the first after you enable your identity above.
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
    </div>
  );
}
