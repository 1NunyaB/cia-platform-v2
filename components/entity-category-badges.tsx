import { INVESTIGATION_CATEGORY_LABELS } from "@/lib/investigation-categories";
import type { InvestigationCategorySlug } from "@/types/analysis";
import { cn } from "@/lib/utils";

export function EntityCategoryBadges({
  categories,
  className,
}: {
  categories: InvestigationCategorySlug[];
  className?: string;
}) {
  if (!categories.length) {
    return <span className="text-xs text-muted-foreground">No categories</span>;
  }
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {categories.map((c) => (
        <span
          key={c}
          className="rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground"
        >
          {INVESTIGATION_CATEGORY_LABELS[c]}
        </span>
      ))}
    </div>
  );
}
