import Link from "next/link";
import { EvidenceCompareWorkspace } from "@/components/evidence-compare-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default async function EvidenceComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a, b } = await searchParams;
  const idA = (a ?? "").trim();
  const idB = (b ?? "").trim();

  if (idA && idB) {
    return <EvidenceCompareWorkspace evidenceIdA={idA} evidenceIdB={idB} />;
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-xl font-semibold text-foreground">Compare evidence</h1>
      <p className="text-sm leading-relaxed text-foreground">
        Pick two files from your{" "}
        <Link href="/evidence" className="font-medium text-primary underline-offset-2 hover:underline">
          evidence library
        </Link>{" "}
        using <span className="font-medium">Select for compare</span>, paste two evidence ids below, or use{" "}
        <code className="rounded bg-muted px-1 text-xs">?a=…&amp;b=…</code> in the URL.
      </p>
      <form method="get" action="/evidence/compare" className="space-y-3 rounded-lg border border-border bg-panel p-4">
        <div className="space-y-1.5">
          <Label htmlFor="cmp-a" className="text-foreground">
            First evidence id
          </Label>
          <Input id="cmp-a" name="a" defaultValue={idA} placeholder="UUID" className="font-mono text-xs" required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="cmp-b" className="text-foreground">
            Second evidence id
          </Label>
          <Input id="cmp-b" name="b" defaultValue={idB} placeholder="UUID" className="font-mono text-xs" required />
        </div>
        <Button type="submit" size="sm">
          Open comparison
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Side-by-side works for images and PDFs; overlay is available for two images.
      </p>
    </div>
  );
}
