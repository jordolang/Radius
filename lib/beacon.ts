/**
 * beacon.ts — Real-time proximity alerts ("a fling at a moment's notice").
 *
 * When two AVAILABLE users come into ~5mi proximity, anyone with beacon mode on
 * gets an immediate, anonymous nudge — explore it now, or ignore it (no action
 * needed, nothing is logged).
 *
 * Bright line (enforced here, not just hoped for):
 *  - An alert is ONLY ever generated about a user who is themselves currently
 *    available. We never surface a bystander, a non-user, or someone who hasn't
 *    opted in. The unexpected part is the timing — never the other person's
 *    consent to be discoverable.
 *  - The alert is anonymous: it carries no name, avatar, count, or location.
 *    Identity reveals only through the existing mutual-interest gate (match.ts).
 *  - No "missed connections" history. The dedup log holds timestamps only, is
 *    pruned aggressively, and is never a viewable trail of who you crossed paths
 *    with. Live or gone.
 */

import { inProximity, type GeoCell } from "./geo";

export type PresenceMode = "passive" | "beacon";

export interface BeaconPresence {
  userId: string;
  cell: GeoCell;
  expiresAt: number;
  mode: PresenceMode; // "beacon" => wants immediate push on proximity
}

/** Anonymous by construction — no identity of the other party. */
export interface BeaconAlert {
  toUserId: string; // recipient (must have beacon mode on)
  matchId: string; // sorted-pair id; opens the consent flow without revealing who
  someoneNearby: true;
  createdAt: number;
}

/** pairKey -> last alerted at. Timestamps only; not a history. */
export type PairAlertLog = Record<string, number>;

const DEFAULT_COOLDOWN_MS = 30 * 60 * 1000; // don't re-ping the same pair constantly

export function pairKey(a: string, b: string): string {
  return [a, b].sort().join("__");
}

function isAvailable(p: BeaconPresence, now: number): boolean {
  return p.expiresAt > now;
}

export interface BeaconOpts {
  isBlocked: (a: string, b: string) => boolean;
  isSuspended: (userId: string) => boolean;
  cooldownMs?: number;
}

/**
 * Called when `subject` updates presence (goes available / moves cell). Returns
 * alerts for pairs that are NEWLY in proximity, plus the updated dedup log.
 *
 * A pair generates alerts only if BOTH are available and eligible. Each side is
 * actually *pushed* only if that side has beacon mode on; a passive-available
 * user still counts as a valid, opted-in candidate (they'll see it in-app) but
 * isn't interrupted with a push.
 */
export function detectAlerts(
  subject: BeaconPresence,
  others: BeaconPresence[],
  log: PairAlertLog,
  opts: BeaconOpts,
  now = Date.now(),
): { alerts: BeaconAlert[]; log: PairAlertLog } {
  const cooldown = opts.cooldownMs ?? DEFAULT_COOLDOWN_MS;
  const alerts: BeaconAlert[] = [];
  const nextLog: PairAlertLog = { ...log };

  if (!isAvailable(subject, now) || opts.isSuspended(subject.userId)) {
    return { alerts, log: nextLog };
  }

  for (const other of others) {
    if (other.userId === subject.userId) continue;
    if (!isAvailable(other, now)) continue; // only opted-in, currently-available users
    if (opts.isSuspended(other.userId)) continue;
    if (opts.isBlocked(subject.userId, other.userId)) continue;
    if (!inProximity(subject.cell, other.cell)) continue;

    const key = pairKey(subject.userId, other.userId);
    const last = nextLog[key] ?? 0;
    if (now - last < cooldown) continue; // already nudged recently; not spammy

    nextLog[key] = now;
    const matchId = key;

    // push only those who asked for immediate alerts
    if (subject.mode === "beacon") {
      alerts.push({ toUserId: subject.userId, matchId, someoneNearby: true, createdAt: now });
    }
    if (other.mode === "beacon") {
      alerts.push({ toUserId: other.userId, matchId, someoneNearby: true, createdAt: now });
    }
  }

  return { alerts, log: nextLog };
}

/**
 * Explicit "remind me later" — suppress re-pings for this pair for a while.
 * (Acting "now" instead just means the client opens the match consent flow.)
 */
export function snooze(
  log: PairAlertLog,
  a: string,
  b: string,
  untilMs: number,
): PairAlertLog {
  return { ...log, [pairKey(a, b)]: untilMs };
}

/**
 * Keep the log from ever becoming a trail: drop entries older than the cooldown.
 * Run periodically. What's gone is gone — there is no crossed-paths archive.
 */
export function pruneLog(
  log: PairAlertLog,
  cooldownMs = DEFAULT_COOLDOWN_MS,
  now = Date.now(),
): PairAlertLog {
  const out: PairAlertLog = {};
  for (const [key, ts] of Object.entries(log)) {
    if (now - ts < cooldownMs) out[key] = ts;
  }
  return out;
}
