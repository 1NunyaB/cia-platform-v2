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
    <div className="min-h-[calc(100vh-6rem)] bg-white text-zinc-950">
      <div className="mx-auto max-w-xl px-4 py-8 space-y-8">
        <header>
          <Link
            href={backHref}
            className="text-sm font-medium text-zinc-600 underline decoration-zinc-300 underline-offset-2 hover:text-zinc-950"
          >
            ← {backLabel}
          </Link>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-zinc-950">{title}</h1>
          {subtitle ? <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{subtitle}</p> : null}
        </header>
        {children}
      </div>
    </div>
  );
}
