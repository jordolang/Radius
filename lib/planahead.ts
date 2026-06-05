/**
 * planahead.ts — "I'll be in <area> within the next 24h" future availability.
 *
 * Privacy invariants (unchanged): coarse cell only, anonymous until mutual
 * opt-in, tentative plans shown grayed-out so a future maybe != present certainty.
 *
 * -- Two different "no-show" ideas, and why only ONE earns a strike ----------
 *
 *  ATTENDANCE ("did they show up at the meet point") — NOT checked, NOT penalized.
 *    Verifying it needs precise continuous tracking (the surveillance this app
 *    refuses) AND penalizing it coerces people into going through with sex they
 *    no longer want. Declining/backing out is ALWAYS free.
 *
 *  REGIONAL PRESENCE ("was the device ever within ~50mi of the claimed area
 *    during the window") — IS checked, and a repeated miss IS penalized. This
 *    catches the real abuse: someone sitting in Illinois declaring they'll be in
 *    Michigan tomorrow, over and over, to scout/scrape users in places they
 *    never go. We can verify this with data we already hold, because 50mi is
 *    far coarser than the 5mi matching cells — no new tracking, no movement
 *    trail. We store only a single boolean + a sample counter per plan, then
 *    discard the detail when the window closes.
 *
 *  The distinction is what keeps it safe: being in the right METRO and then
 *  declining everyone = no strike. Claiming a metro you were never near = strike.
 *  3 strikes => lose plan-ahead only; live presence is unaffected.
 */

import { cellDistanceMiles, inProximity, type GeoCell } from "./geo";

const MAX_HORIZON_MS = 24 * 60 * 60 * 1000;
const REGION_RADIUS_MILES = 50; // coarse vicinity check, not a meet-point check
const STRIKES_TO_LOCK = 3;
const SPAM_CREATE_THRESHOLD = 5;

/** How far ahead a user may broadcast a future plan (hours). Capped at 24h. */
export const PLAN_LEAD_OPTIONS = [2, 4, 8, 12, 24] as const;
export type PlanLeadHours = (typeof PLAN_LEAD_OPTIONS)[number];

/**
 * The deliberately-vague public phrase for a lead time. We never show an exact
 * arrival time (same reason we never show an exact place) — only a coarse window,
 * so a future "maybe" can't be turned into a precise rendezvous.
 */
export function leadPhrase(hours: number): string {
  switch (hours) {
    case 2: return "in the next few hours";
    case 4: return "in the next several hours";
    case 8: return "in the upcoming hours";
    case 12: return "sometime today";
    case 24: return "within the next day";
    default: return "soon";
  }
}

export function isPlanLeadHours(n: unknown): n is PlanLeadHours {
  return typeof n === "number" && (PLAN_LEAD_OPTIONS as readonly number[]).includes(n);
}

export type PlanStatus = "tentative" | "live" | "expired" | "cancelled";

export interface PlannedPresence {
  userId: string;
  cell: GeoCell; // coarse FUTURE area
  windowStart: number;
  windowEnd: number;
  status: PlanStatus;
  createdAt: number;
  // Regional-presence accounting. Booleans/counters only — NEVER a location trail.
  everInRegion: boolean; // did any coarse presence land within ~50mi during window?
  presenceSamples: number; // how many presence pings we saw during the window
}

export function createPlan(
  userId: string,
  cell: GeoCell,
  windowStart: number,
  windowEnd: number,
  now = Date.now(),
): PlannedPresence {
  if (windowEnd <= windowStart) throw new Error("window end must be after start");
  if (windowStart < now - 60_000) throw new Error("window can't start in the past");
  if (windowStart > now + MAX_HORIZON_MS) throw new Error("plan must be within the next 24h");
  return {
    userId,
    cell,
    windowStart,
    windowEnd,
    status: "tentative",
    createdAt: now,
    everInRegion: false,
    presenceSamples: 0,
  };
}

export function plansMatch(a: PlannedPresence, b: PlannedPresence): boolean {
  if (a.userId === b.userId) return false;
  if (a.status !== "tentative" || b.status !== "tentative") return false;
  const overlap = a.windowStart < b.windowEnd && b.windowStart < a.windowEnd;
  return overlap && inProximity(a.cell, b.cell);
}

/**
 * Called whenever the user goes live (ANYWHERE) while this plan's window is open.
 * Updates ONLY a boolean + counter. The live cell is compared and then dropped —
 * we never store where they were, just whether it was within the claimed region.
 */
export function observePresence(
  plan: PlannedPresence,
  liveCell: GeoCell,
  now = Date.now(),
): PlannedPresence {
  if (now < plan.windowStart || now > plan.windowEnd) return plan;
  const within = cellDistanceMiles(plan.cell, liveCell) <= REGION_RADIUS_MILES;
  return {
    ...plan,
    presenceSamples: plan.presenceSamples + 1,
    everInRegion: plan.everInRegion || within,
  };
}

/** User's own action: go live in/near the planned area during the window. */
export function convertToLive(
  plan: PlannedPresence,
  liveCell: GeoCell,
  now = Date.now(),
): { plan: PlannedPresence; converted: boolean; reason?: string } {
  if (plan.status !== "tentative") return { plan, converted: false, reason: `plan is ${plan.status}` };
  if (now < plan.windowStart || now > plan.windowEnd)
    return { plan, converted: false, reason: "outside the planned window" };
  if (!inProximity(plan.cell, liveCell))
    return { plan, converted: false, reason: "not in the planned area" };
  const observed = observePresence(plan, liveCell, now);
  return { plan: { ...observed, status: "live" }, converted: true };
}

/** Always free, never a strike. */
export function cancelPlan(plan: PlannedPresence): PlannedPresence {
  return { ...plan, status: "cancelled" };
}

// -- Reliability: regional-presence misses + plan-spam -----------------------

export interface PlannerReliability {
  userId: string;
  plansCreated: number;
  plansEngaged: number;
  strikes: number;
  plannerLocked: boolean; // plan-ahead only; live presence still works
}

export function emptyReliability(userId: string): PlannerReliability {
  return { userId, plansCreated: 0, plansEngaged: 0, strikes: 0, plannerLocked: false };
}

export function onPlanCreated(r: PlannerReliability): PlannerReliability {
  return { ...r, plansCreated: r.plansCreated + 1 };
}
export function onPlanEngaged(r: PlannerReliability): PlannerReliability {
  return { ...r, plansEngaged: r.plansEngaged + 1 };
}

function recordStrike(r: PlannerReliability): PlannerReliability {
  const strikes = r.strikes + 1;
  return { ...r, strikes, plannerLocked: strikes >= STRIKES_TO_LOCK };
}

/**
 * Run when a plan's window has elapsed. Decides whether the planner earns a
 * regional-presence strike.
 *
 *   no presence samples at all -> no evidence -> quiet expiry, NO strike
 *   samples exist, none within 50mi -> claimed a region never near -> STRIKE
 *   at least one sample within 50mi -> in the vicinity -> NO strike
 *     (whether or not they actually met anyone — declining is free)
 */
export function assessOnWindowEnd(
  plan: PlannedPresence,
  reliability: PlannerReliability,
  now = Date.now(),
): { plan: PlannedPresence; reliability: PlannerReliability; outcome: string } {
  if (plan.status !== "tentative" && plan.status !== "live") {
    return { plan, reliability, outcome: `no-op (${plan.status})` };
  }
  if (now <= plan.windowEnd) {
    return { plan, reliability, outcome: "window still open" };
  }
  const expired: PlannedPresence = { ...plan, status: "expired" };

  if (plan.presenceSamples === 0) {
    return { plan: expired, reliability, outcome: "no presence data — quiet expiry, no strike" };
  }
  if (!plan.everInRegion) {
    return {
      plan: expired,
      reliability: recordStrike(reliability),
      outcome: "regional no-show — was never within ~50mi of the claimed area",
    };
  }
  return { plan: expired, reliability, outcome: "was in the region — no strike (declining is free)" };
}

/** Complementary signal: many plans, zero engagement = harvesting pattern. */
export function evaluateSpam(r: PlannerReliability): PlannerReliability {
  if (r.plansCreated >= SPAM_CREATE_THRESHOLD && r.plansEngaged === 0) {
    return recordStrike({ ...r, plansCreated: 0 });
  }
  return r;
}

export function canCreatePlans(r: PlannerReliability): boolean {
  return !r.plannerLocked;
}
