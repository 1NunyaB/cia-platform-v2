"use client";

const links = [
  { href: "#overview", label: "Overview" },
  { href: "#investigation-categories", label: "Categories" },
  { href: "#evidence", label: "Evidence" },
  { href: "#notes-comments", label: "Notes & comments" },
] as const;

export function CaseSectionNav() {
  return (
    <nav
      aria-label="Case sections"
      className="flex flex-wrap gap-2 border-b border-border/60 pb-4 text-xs font-medium"
    >
      {links.map(({ href, label }) => (
        <a
          key={href}
          href={href}
          className="rounded-md border border-transparent bg-muted/20 px-3 py-1.5 text-muted-foreground transition-colors hover:border-border/80 hover:bg-muted/40 hover:text-foreground"
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
