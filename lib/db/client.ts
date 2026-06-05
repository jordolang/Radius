/**
 * db/client.ts — the single server-side Supabase client.
 *
 * Uses the SERVICE-ROLE key, so it bypasses RLS. That is safe ONLY because this
 * module must never be imported into client code: every table is RLS-locked with
 * no policies, so a leaked anon/publishable key grants zero access, and all real
 * authorization is enforced in our API routes against the Clerk session.
 *
 * Never import this from a "use client" file.
 */

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function db(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  cached = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cached;
}
