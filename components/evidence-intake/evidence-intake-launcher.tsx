import Link from "next/link";
import { FileUp, Files, Link2 } from "lucide-react";

type LauncherOption = {
  href: string;
  title: string;
  description: string;
  when: string;
  icon: typeof FileUp;
};

export function EvidenceIntakeLauncher({
  basePath,
  contextLabel,
  parentBack,
}: {
  /** e.g. `/cases/abc/evidence/add` or `/evidence/add` — no trailing slash */
  basePath: string;
  /** Short line about where evidence will go */
  contextLabel: string;
  /** Optional link above the title (e.g. back to case or evidence list). */
  parentBack?: { href: string; label: string };
}) {
  const options: LauncherOption[] = [
    {
      href: `${basePath}/file`,
      title: "Upload file",
      description: "Add one document from your computer.",
      when: "Use for a single PDF, memo, image, or transcript you want in the database immediately.",
      icon: FileUp,
    },
    {
      href: `${basePath}/bulk`,
      title: "Upload multiple files",
      description: "Select several files in one batch.",
      when: "Use when you already have a folder of related materials and want the same source details on every file.",
      icon: Files,
    },
    {
      href: `${basePath}/url`,
      title: "Import from URL",
      description: "Pull text from a public web page or direct file link.",
      when: "Use when the material is already online — articles, reports, or hosted PDFs with a stable https:// link.",
      icon: Link2,
    },
  ];

  return (
    <div className="bg-card text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {parentBack ? (
          <Link
            href={parentBack.href}
            className="inline-block text-sm font-medium text-muted-foreground underline decoration-border underline-offset-2 hover:text-foreground"
          >
            ← {parentBack.label}
          </Link>
        ) : null}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Add evidence</h1>
          <p className="mt-2 text-sm text-zinc-600 leading-relaxed">{contextLabel}</p>
        </div>

        <p className="text-sm text-alert-foreground rounded-lg border border-alert-border bg-alert px-4 py-3">
          <strong className="font-semibold">Security:</strong> uploads are validated and scanned before storage.
          Blocked files are never saved. Allowed types include PDF, text, Office, images, and common audio/video —
          not executables or archives.
        </p>

        <ul className="grid gap-4 sm:grid-cols-1">
          {options.map((opt) => {
            const Icon = opt.icon;
            return (
              <li key={opt.href}>
                <Link
                  href={opt.href}
                  className="group flex gap-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:border-zinc-400 hover:shadow-md"
                >
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-foreground">
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1 space-y-1">
                    <span className="block text-base font-semibold text-foreground">{opt.title}</span>
                    <span className="block text-sm text-zinc-700">{opt.description}</span>
                    <span className="block text-xs text-zinc-500 leading-relaxed">
                      <span className="font-medium text-zinc-700">When to use:</span> {opt.when}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
