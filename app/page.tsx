import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="max-w-lg text-center space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">CIA Platform</h1>
        <p className="text-muted-foreground">
          Collaborative investigation workspace — cases, evidence, structured AI analysis, and team notes.
        </p>
      </div>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/login">Log in</Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/signup">Sign up</Link>
        </Button>
      </div>
    </div>
  );
}
