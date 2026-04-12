import { createClient } from "@supabase/supabase-js";
import type { AppSupabaseClient } from "@/types";

const clientOptions = {
  auth: { persistSession: false, autoRefreshToken: false },
} as const;

/**
 * Returns a service-role client, or null if env is not configured.
 * Prefer this in Server Components so the UI can render a setup notice instead of crashing.
 */
export function tryCreateServiceClient(): AppSupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, clientOptions);
}

/**
 * Server-only Supabase client using the service role key. Bypasses RLS — use only in
 * Route Handlers and Server Components, never in client bundles.
 */
export function createServiceClient(): AppSupabaseClient {
  const client = tryCreateServiceClient();
  if (!client) {
    throw new Error(
      "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local (service role is required for the no-auth MVP).",
    );
  }
  return client;
}
          