/**
 * auth.ts — server-side identity, sourced from the Clerk session ONLY.
 *
 * The "me" in every API route comes from here, never from the request body or a
 * query param. That's the fix for the old demoUserId spoofing hole: a client can
 * no longer act as an arbitrary user id. Peer ids (the other side of a match) are
 * still validated against the authed user's membership in that match.
 */

import "server-only";
import { auth } from "@clerk/nextjs/server";
import { ensureUser } from "@/lib/db/repo";

/** The authenticated Clerk user id, or null if signed out. No writes. */
export async function getUserId(): Promise<string | null> {
  const { userId } = await auth();
  return userId ?? null;
}

/**
 * The authenticated user id, guaranteeing a `users` row exists (so FKs from
 * profiles/preferences/presence resolve). Returns null if signed out — routes
 * translate that into a 401.
 */
export async function getUserIdEnsured(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  await ensureUser(userId);
  return userId;
}
