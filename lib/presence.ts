/**
 * presence.ts — "available right now" presence + proximity matching.
 *
 * Match rule (all must hold):
 *   1. Both users currently available (presence not expired).
 *   2. Their coarse cells are within proximity (~5mi grid).
 *   3. Neither has blocked the other and neither is suspended/banned.
 *
 * The alert that results is symmetric and anonymous: each side learns only
 * "someone nearby is also available" — no name, no avatar, no location, and
 * crucially no count (a count could de-anonymize in a sparse area).
 */

import { inProximity, toCoarseCell, type GeoCell } from "./geo";
import type { Presence, TrustState, UserId } from "./types";

export interface PresenceStore {
  upsert(p: Presence): Promise<void>;
  remove(userId: UserId): Promise<void>;
  get(userId: UserId): Promise<Presence | null>;
  /** All presences (expired ones may be included; caller filters). */
  all(): Promise<Presence[]>;
  isBlockedBetween(a: UserId, b: UserId): Promise<boolean>;
  trustStatus(userId: UserId): Promise<TrustState["status"]>;
  /** Mutual absolutes gate: both inside each other's preferences (lib/preferences). */
  compatible(a: UserId, b: UserId): Promise<boolean>;
}

const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000; // 2h: presence auto-expires

export function isActive(p: Presence, now = Date.now()): boolean {
  return p.expiresAt > now;
}

/** Turn availability ON. Quantizes the precise point to a coarse cell here, once. */
export async function goAvailable(
  store: PresenceStore,
  userId: UserId,
  lat: number,
  lng: number,
  ttlMs: number = DEFAULT_TTL_MS,
): Promise<Presence> {
  const status = await store.trustStatus(userId);
  if (status === "suspended" || status === "banned") {
    throw new Error("account not permitted to broadcast availability");
  }
  const now = Date.now();
  const cell: GeoCell = toCoarseCell(lat, lng); // raw lat/lng discarded after this line
  const presence: Presence = {
    userId,
    cell,
    expiresAt: now + ttlMs,
    updatedAt: now,
  };
  await store.upsert(presence);
  return presence;
}

/** Turn availability OFF immediately. */
export async function goUnavailable(
  store: PresenceStore,
  userId: UserId,
): Promise<void> {
  await store.remove(userId);
}

/**
 * Find currently-available users near `userId`. Returns only user ids of valid
 * candidates — never their cells or any location detail.
 */
export async function findCandidates(
  store: PresenceStore,
  userId: UserId,
  now = Date.now(),
): Promise<UserId[]> {
  const me = await store.get(userId);
  if (!me || !isActive(me, now)) return [];

  const everyone = await store.all();
  const out: UserId[] = [];

  for (const other of everyone) {
    if (other.userId === userId) continue;
    if (!isActive(other, now)) continue; // expired availability is invisible
    if (!inProximity(me.cell, other.cell)) continue;
    if (await store.isBlockedBetween(userId, other.userId)) continue;
    if (!(await store.compatible(userId, other.userId))) continue; // outside either's absolutes
    const status = await store.trustStatus(other.userId);
    if (status === "suspended" || status === "banned") continue;
    out.push(other.userId);
  }
  return out;
}

/**
 * The anonymous alert payload. Note what is ABSENT: no ids of who is nearby,
 * no avatars, no count. Just a boolean nudge to open the app.
 */
export interface ProximityAlert {
  someoneNearbyAvailable: boolean;
}

export async function proximityAlert(
  store: PresenceStore,
  userId: UserId,
  now = Date.now(),
): Promise<ProximityAlert> {
  const candidates = await findCandidates(store, userId, now);
  return { someoneNearbyAvailable: candidates.length > 0 };
}
