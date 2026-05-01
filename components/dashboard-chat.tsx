"use client";

type DashboardChatProps = {
  variant?: string;
  initialMessages?: unknown[];
  profiles?: Record<string, unknown>;
  currentUserId?: string;
  isPlatformAdmin?: boolean;
};

export function DashboardChat(_props: DashboardChatProps) {
  return (
    <div className="h-full w-full rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
      Dashboard Chat coming soon
    </div>
  );
}