"use client";

/**
 * useAuthUserId — the client's view of "who am I", from the Clerk session.
 *
 * Replaces the old demoUserId() localStorage stub. `userId` is the Clerk user id
 * (the same id used as the foreign key across Supabase tables); it's null until
 * Clerk has loaded or when signed out. Pages use `loaded`/`signedIn` to gate UI.
 */

import { useAuth } from "@clerk/nextjs";

export function useAuthUserId(): { userId: string | null; loaded: boolean; signedIn: boolean } {
  const { userId, isLoaded, isSignedIn } = useAuth();
  return { userId: userId ?? null, loaded: isLoaded, signedIn: Boolean(isSignedIn) };
}
