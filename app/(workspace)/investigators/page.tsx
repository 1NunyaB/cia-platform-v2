import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { InvestigatorWallCard } from "@/lib/investigator-profile";
import { InvestigatorsLive } from "@/components/investigators-live";

export const dynamic = "force-dynamic";

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
    .neq("investigator_alias", "")
    .order("investigator_alias", { ascending: true });

  const wall = (error ? [] : rows ?? []) as InvestigatorWallCard[];

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

      <InvestigatorsLive userId={user?.id ?? null} initialWall={wall} />
    </div>
  );
}
