"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { UserNotificationRow } from "@/services/notification-service";

/**
 * Subscribes to INSERT on `user_notifications` for the signed-in user (RLS + Realtime).
 */
export function useNotificationsRealtime(
  userId: string | null | undefined,
  onInsert: (row: UserNotificationRow) => void,
) {
  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const filter = `user_id=eq.${userId}`;
    const channel = supabase
      .channel(`user-notifications:${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "user_notifications",
          filter,
        },
        (payload) => {
          onInsert(payload.new as UserNotificationRow);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [userId, onInsert]);
}
