import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function DatabaseSetupNotice() {
  return (
    <Alert className="border-amber-500/40 bg-amber-500/5 text-foreground">
      <AlertTitle className="text-amber-200/95">Database not configured</AlertTitle>
      <AlertDescription className="text-muted-foreground mt-1 text-sm leading-relaxed">
        Add <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
        <code className="rounded bg-muted px-1 py-0.5 text-xs">.env.local</code> for sign-in and data access.
        Apply Supabase migrations from <code className="rounded bg-muted px-1 py-0.5 text-xs">supabase/migrations</code>.
        Optional: <code className="rounded bg-muted px-1 py-0.5 text-xs">SUPABASE_SERVICE_ROLE_KEY</code> for
        specific server routes — never expose it to the client.
      </AlertDescription>
    </Alert>
  );
}
