import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <header className="border-b bg-card">
        <div className="container flex h-14 items-center justify-between gap-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="font-semibold">
              CIA Platform
            </Link>
            <Link
              href="/dashboard"
              className="text-muted-foreground hover:text-foreground"
            >
              Dashboard
            </Link>
            <Link
              href="/cases"
              className="text-muted-foreground hover:text-foreground"
            >
              Cases
            </Link>
            <Link
              href="/evidence"
              className="text-muted-foreground hover:text-foreground"
            >
              Evidence
            </Link>
            <Link
              href="/explore"
              className="text-muted-foreground hover:text-foreground"
            >
              Public
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" asChild>
              <Link href="/cases/new">New case</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 container py-8">{children}</main>
    </div>
  );
}