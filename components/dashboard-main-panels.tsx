"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DashboardChat } from "@/components/dashboard-chat";
import { DashboardEvidencePreview, type DashboardEvidencePreviewRow } from "@/components/dashboard-evidence-preview";
import type { DashboardChatMessageRow } from "@/services/collaboration-service";
import type { ProfileWithInvestigator } from "@/lib/profiles";

export function DashboardMainPanels({
  chatMessages,
  chatProfiles,
  evidenceRows,
  currentUserId,
  isPlatformAdmin,
}: {
  chatMessages: DashboardChatMessageRow[];
  chatProfiles: Record<string, ProfileWithInvestigator>;
  evidenceRows: DashboardEvidencePreviewRow[];
  currentUserId: string | null;
  isPlatformAdmin: boolean;
}) {
  const [chatVisible, setChatVisible] = useState(true);

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button type="button" size="sm" variant="outline" onClick={() => setChatVisible((v) => !v)}>
          {chatVisible ? "Hide chat" : "Show chat"}
        </Button>
      </div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className={chatVisible ? "lg:col-span-9" : "lg:col-span-12"}>
          <DashboardEvidencePreview rows={evidenceRows} />
        </div>
        {chatVisible ? (
          <div className="lg:col-span-3">
            <DashboardChat
              initialMessages={chatMessages}
              profiles={chatProfiles}
              currentUserId={currentUserId}
              isPlatformAdmin={isPlatformAdmin}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}

