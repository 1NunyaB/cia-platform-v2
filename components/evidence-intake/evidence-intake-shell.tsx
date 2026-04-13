import Link from "next/link";

export function EvidenceIntakeShell({
  backHref,
  backLabel,
  title,
  subtitle,
  children,
}: {
  backHref: string;
  backLabel: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-[calc(100vh-6rem)] bg-card text-foreground">
      <div className="mx-auto max-w-xl px-4 py-8 space-y-8">
        <header>
          <Link
            href={backHref}
            className="text-sm font-medium text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
          >
            ← {backLabel}
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
