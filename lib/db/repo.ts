/**
 * db/repo.ts — async, Supabase-backed persistence for the matching core.
 *
 * Replaces the in-memory maps in lib/store.ts for: users, profiles, preferences,
 * presence (+ beacon mode), matches, trust, blocks, reports, and the beacon log.
 * Mappers translate snake_case rows to/from the existing domain types so the pure
 * libs (lib/presence, lib/beacon, lib/match) and the routes stay unchanged in shape.
 *
 * Server-only: pulls in db()/the service-role client.
 */

import "server-only";
import { db } from "./client";
import type { Match, Presence, SafetyReport, TrustState, UserId } from "@/lib/types";
import type { Profile } from "@/lib/profile";
import {
  factsFromProfile, mutuallyCompatible, type Preferences,
} from "@/lib/preferences";
import type { PresenceStore } from "@/lib/presence";
import type { PairAlertLog } from "@/lib/beacon";
import { emptyTrustState } from "@/lib/safety";
import { emptyReliability, type PlannedPresence, type PlannerReliability } from "@/lib/planahead";
import type { EphemeralItem } from "@/lib/ephemeral";
import type { SignalMessage } from "@/lib/premeet-signaling";

const ms = (iso: string | null): number => (iso ? new Date(iso).getTime() : 0);
const iso = (epochMs: number): string => new Date(epochMs).toISOString();

function orThrow<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

// ── users ───────────────────────────────────────────────────────────────────
export async function ensureUser(id: UserId): Promise<void> {
  const { error } = await db().from("users").upsert({ id }, { onConflict: "id", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function setAgeVerified(id: UserId, verified: boolean): Promise<void> {
  const { error } = await db().from("users").update({ age_verified: verified }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── profiles ──────────────────────────────────────────────────────────────––
// Row params are typed `any`: the Supabase client isn't generated-typed here, so
// rows come back loosely typed and the mappers below are the typing boundary.
function rowToProfile(r: any): Profile {
  return {
    userId: r.user_id, alias: r.alias, avatarUrl: r.avatar_url,
    age: r.age, heightInches: r.height_inches, weightLbs: r.weight_lbs,
    gender: r.gender, seeking: r.seeking, heightBand: r.height_band, buildBand: r.build_band,
    bodyType: r.body_type, hairColor: r.hair_color, hairLength: r.hair_length,
    eyeColor: r.eye_color ?? undefined, skinTone: r.skin_tone ?? undefined,
    smoking: r.smoking, drinking: r.drinking, cannabis: r.cannabis, otherDrugs: r.other_drugs,
    relationshipStatus: r.relationship_status, nonDeceptionAttestation: r.non_deception_attestation,
    ethnicity: r.ethnicity ?? undefined, bio: r.bio ?? undefined,
    bioMessages: r.bio_messages ?? undefined, revealPhotos: r.reveal_photos ?? undefined,
    createdAt: ms(r.created_at),
  };
}

export async function getProfile(userId: UserId): Promise<Profile | null> {
  const data = orThrow(await db().from("profiles").select("*").eq("user_id", userId).maybeSingle());
  return data ? rowToProfile(data) : null;
}

export async function putProfile(p: Profile): Promise<void> {
  // Note: profile_health is a separate table; nothing health-related is written here.
  const { error } = await db().from("profiles").upsert({
    user_id: p.userId, alias: p.alias, avatar_url: p.avatarUrl,
    age: p.age, height_inches: p.heightInches, weight_lbs: p.weightLbs,
    gender: p.gender, seeking: p.seeking, height_band: p.heightBand, build_band: p.buildBand,
    body_type: p.bodyType, hair_color: p.hairColor, hair_length: p.hairLength,
    eye_color: p.eyeColor ?? null, skin_tone: p.skinTone ?? null,
    smoking: p.smoking, drinking: p.drinking, cannabis: p.cannabis, other_drugs: p.otherDrugs,
    relationship_status: p.relationshipStatus, non_deception_attestation: p.nonDeceptionAttestation,
    ethnicity: p.ethnicity ?? null, bio: p.bio ?? null,
    bio_messages: p.bioMessages ?? null, reveal_photos: p.revealPhotos ?? null,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** Aliases currently in use, for the identity offer. */
export async function aliasesInUse(): Promise<Set<string>> {
  const data = orThrow(await db().from("profiles").select("alias"));
  return new Set((data ?? []).map((r: any) => r.alias));
}

// ── preferences ───────────────────────────────────────────────────────────––
function rowToPreferences(r: any): Preferences {
  return {
    userId: r.user_id,
    ageMin: r.age_min, ageMax: r.age_max,
    heightMinIn: r.height_min_in, heightMaxIn: r.height_max_in,
    weightMinLbs: r.weight_min_lbs, weightMaxLbs: r.weight_max_lbs,
    hairColors: r.hair_colors ?? undefined, eyeColors: r.eye_colors ?? undefined,
    skinTones: r.skin_tones ?? undefined,
    createdAt: ms(r.created_at),
  };
}

export async function getPreferences(userId: UserId): Promise<Preferences | null> {
  const data = orThrow(await db().from("preferences").select("*").eq("user_id", userId).maybeSingle());
  return data ? rowToPreferences(data) : null;
}

export async function putPreferences(p: Preferences): Promise<void> {
  const { error } = await db().from("preferences").upsert({
    user_id: p.userId, age_min: p.ageMin, age_max: p.ageMax,
    height_min_in: p.heightMinIn, height_max_in: p.heightMaxIn,
    weight_min_lbs: p.weightMinLbs, weight_max_lbs: p.weightMaxLbs,
    hair_colors: p.hairColors ?? null, eye_colors: p.eyeColors ?? null,
    skin_tones: p.skinTones ?? null,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

// ── compatibility (the absolutes gate) ──────────────────────────────────────
export async function areCompatible(a: UserId, b: UserId): Promise<boolean> {
  const set = await compatibleSet(a, [b]);
  return set.has(b);
}

/** Of `others`, which mutually pass absolutes with `me`. One round-trip pair of queries. */
export async function compatibleSet(me: UserId, others: UserId[]): Promise<Set<UserId>> {
  const ids = [me, ...others];
  if (others.length === 0) return new Set();
  const profileRows = orThrow(await db().from("profiles").select("*").in("user_id", ids));
  const prefRows = orThrow(await db().from("preferences").select("*").in("user_id", ids));

  const profiles = new Map<UserId, Profile>((profileRows ?? []).map((r: any) => [r.user_id, rowToProfile(r)]));
  const prefs = new Map<UserId, Preferences>((prefRows ?? []).map((r: any) => [r.user_id, rowToPreferences(r)]));

  const mp = profiles.get(me), mpref = prefs.get(me);
  const out = new Set<UserId>();
  if (!mp || !mpref) return out; // I haven't completed profile + absolutes -> no matches
  const meParty = { pref: mpref, facts: factsFromProfile(mp) };

  for (const other of others) {
    const op = profiles.get(other), opref = prefs.get(other);
    if (!op || !opref) continue;
    if (mutuallyCompatible(meParty, { pref: opref, facts: factsFromProfile(op) })) out.add(other);
  }
  return out;
}

// ── presence + beacon mode ───────────────────────────────────────────────────
function rowToPresence(r: any): Presence {
  return { userId: r.user_id, cell: r.cell, expiresAt: ms(r.expires_at), updatedAt: ms(r.updated_at) };
}

export async function getMode(userId: UserId): Promise<"passive" | "beacon"> {
  const data = orThrow(await db().from("presence_mode").select("mode").eq("user_id", userId).maybeSingle());
  return (data?.mode as "passive" | "beacon") ?? "passive";
}

export async function setMode(userId: UserId, mode: "passive" | "beacon"): Promise<void> {
  const { error } = await db().from("presence_mode").upsert({ user_id: userId, mode }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

/** PresenceStore implementation consumed by lib/presence (findCandidates, etc.). */
export const presenceStore: PresenceStore = {
  async upsert(p) {
    const { error } = await db().from("presence").upsert({
      user_id: p.userId, cell: p.cell, expires_at: iso(p.expiresAt), updated_at: iso(p.updatedAt),
    }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
  },
  async remove(id) {
    const { error } = await db().from("presence").delete().eq("user_id", id);
    if (error) throw new Error(error.message);
  },
  async get(id) {
    const data = orThrow(await db().from("presence").select("*").eq("user_id", id).maybeSingle());
    return data ? rowToPresence(data) : null;
  },
  async all() {
    const data = orThrow(await db().from("presence").select("*"));
    return (data ?? []).map(rowToPresence);
  },
  async isBlockedBetween(a, b) {
    return isBlocked(a, b);
  },
  async trustStatus(id) {
    return (await getTrust(id)).status;
  },
  async compatible(a, b) {
    return areCompatible(a, b);
  },
};

// ── matches ───────────────────────────────────────────────────────────────––
function rowToMatch(r: any): Match {
  return {
    id: r.id, a: r.user_a, b: r.user_b, stage: r.stage,
    interested: { [r.user_a]: r.a_interested, [r.user_b]: r.b_interested },
    contentSharingConsent: { [r.user_a]: r.a_content_consent, [r.user_b]: r.b_content_consent },
    archived: Boolean(r.archived),
    createdAt: ms(r.created_at), updatedAt: ms(r.updated_at),
  };
}

export async function getMatch(id: string): Promise<Match | null> {
  const data = orThrow(await db().from("matches").select("*").eq("id", id).maybeSingle());
  return data ? rowToMatch(data) : null;
}

/** All matches the user is part of, most recently active first. */
export async function getMatchesForUser(userId: UserId): Promise<Match[]> {
  const data = orThrow(
    await db().from("matches").select("*")
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order("updated_at", { ascending: false }),
  );
  return (data ?? []).map(rowToMatch);
}

export async function putMatch(m: Match): Promise<void> {
  const { error } = await db().from("matches").upsert({
    id: m.id, user_a: m.a, user_b: m.b, stage: m.stage,
    a_interested: m.interested[m.a], b_interested: m.interested[m.b],
    a_content_consent: m.contentSharingConsent[m.a], b_content_consent: m.contentSharingConsent[m.b],
    archived: m.archived ?? false,
    updated_at: iso(m.updatedAt),
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function setMatchArchived(id: string, archived: boolean): Promise<void> {
  const { error } = await db().from("matches").update({ archived }).eq("id", id);
  if (error) throw new Error(error.message);
}

// ── safety: trust, blocks, reports ───────────────────────────────────────────
const blockKey = (a: UserId, b: UserId) => [a, b].sort().join("|");

function rowToTrust(r: any): TrustState {
  return {
    userId: r.user_id, standardFlags: r.standard_flags, severeFlags: r.severe_flags,
    falseReportsFiled: r.false_reports_filed, status: r.status,
  };
}

export async function getTrust(id: UserId): Promise<TrustState> {
  const data = orThrow(await db().from("trust").select("*").eq("user_id", id).maybeSingle());
  return data ? rowToTrust(data) : emptyTrustState(id);
}

export async function setTrust(s: TrustState): Promise<void> {
  const { error } = await db().from("trust").upsert({
    user_id: s.userId, standard_flags: s.standardFlags, severe_flags: s.severeFlags,
    false_reports_filed: s.falseReportsFiled, status: s.status,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

export async function isBlocked(a: UserId, b: UserId): Promise<boolean> {
  const data = orThrow(await db().from("blocks").select("pair_key").eq("pair_key", blockKey(a, b)).maybeSingle());
  return Boolean(data);
}

export async function block(a: UserId, b: UserId): Promise<void> {
  const { error } = await db().from("blocks").upsert({ pair_key: blockKey(a, b) }, { onConflict: "pair_key", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
}

export async function addReport(r: SafetyReport): Promise<void> {
  const { error } = await db().from("reports").insert({
    id: r.id, reporter_id: r.reporterId, reported_id: r.reportedId,
    category: r.category, severity: r.severity, note: r.note ?? null,
  });
  if (error) throw new Error(error.message);
}

// ── bulk prefetch helpers (so beacon's sync predicates can run over DB data) ──
export async function getModes(ids: UserId[]): Promise<Map<UserId, "passive" | "beacon">> {
  const out = new Map<UserId, "passive" | "beacon">();
  if (ids.length === 0) return out;
  const data = orThrow(await db().from("presence_mode").select("user_id, mode").in("user_id", ids));
  for (const r of data ?? []) out.set((r as any).user_id, (r as any).mode);
  return out;
}

export async function blockedPairKeys(): Promise<Set<string>> {
  const data = orThrow(await db().from("blocks").select("pair_key"));
  return new Set((data ?? []).map((r: any) => r.pair_key));
}

export async function suspendedSet(ids: UserId[]): Promise<Set<UserId>> {
  const out = new Set<UserId>();
  if (ids.length === 0) return out;
  const data = orThrow(await db().from("trust").select("user_id, status").in("user_id", ids));
  for (const r of data ?? []) {
    if ((r as any).status === "suspended" || (r as any).status === "banned") out.add((r as any).user_id);
  }
  return out;
}

// ── beacon dedup log ──────────────────────────────────────────────────────––
export async function getBeaconLog(): Promise<PairAlertLog> {
  const data = orThrow(await db().from("beacon_log").select("*"));
  const log: PairAlertLog = {};
  for (const r of data ?? []) log[(r as any).pair_key] = ms((r as any).last_alerted_at);
  return log;
}

export async function setBeaconLog(log: PairAlertLog): Promise<void> {
  const rows = Object.entries(log).map(([pair_key, t]) => ({ pair_key, last_alerted_at: iso(t) }));
  if (rows.length === 0) return;
  const { error } = await db().from("beacon_log").upsert(rows, { onConflict: "pair_key" });
  if (error) throw new Error(error.message);
}

// ── age verification flag ─────────────────────────────────────────────────––
export async function isAgeVerified(userId: UserId): Promise<boolean> {
  const data = orThrow(await db().from("users").select("age_verified").eq("id", userId).maybeSingle());
  return Boolean(data?.age_verified);
}

// ── plan-ahead ────────────────────────────────────────────────────────────––
export const planKey = (p: PlannedPresence): string => `${p.userId}:${p.createdAt}`;

function rowToPlan(r: any): PlannedPresence {
  return {
    userId: r.user_id, cell: r.cell,
    windowStart: ms(r.window_start), windowEnd: ms(r.window_end),
    status: r.status, createdAt: ms(r.created_at),
    everInRegion: r.ever_in_region, presenceSamples: r.presence_samples,
  };
}

export async function putPlan(p: PlannedPresence): Promise<string> {
  const id = planKey(p);
  const { error } = await db().from("plans").upsert({
    id, user_id: p.userId, cell: p.cell,
    window_start: iso(p.windowStart), window_end: iso(p.windowEnd),
    status: p.status, ever_in_region: p.everInRegion, presence_samples: p.presenceSamples,
    created_at: iso(p.createdAt),
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return id;
}

export async function getPlan(id: string): Promise<PlannedPresence | null> {
  const data = orThrow(await db().from("plans").select("*").eq("id", id).maybeSingle());
  return data ? rowToPlan(data) : null;
}

function rowToReliability(r: any): PlannerReliability {
  return {
    userId: r.user_id, plansCreated: r.plans_created, plansEngaged: r.plans_engaged,
    strikes: r.strikes, plannerLocked: r.planner_locked,
  };
}

export async function getReliability(userId: UserId): Promise<PlannerReliability> {
  const data = orThrow(await db().from("planner_reliability").select("*").eq("user_id", userId).maybeSingle());
  return data ? rowToReliability(data) : emptyReliability(userId);
}

export async function setReliability(r: PlannerReliability): Promise<void> {
  const { error } = await db().from("planner_reliability").upsert({
    user_id: r.userId, plans_created: r.plansCreated, plans_engaged: r.plansEngaged,
    strikes: r.strikes, planner_locked: r.plannerLocked,
  }, { onConflict: "user_id" });
  if (error) throw new Error(error.message);
}

// ── ephemeral media items ─────────────────────────────────────────────────––
function rowToItem(r: any): EphemeralItem {
  return {
    id: r.id, matchId: r.match_id, senderId: r.sender_id, recipientId: r.recipient_id,
    state: r.state, maxViews: r.max_views, viewsUsed: r.views_used,
    expiresAt: ms(r.expires_at), createdAt: ms(r.created_at),
  };
}

export async function putItem(i: EphemeralItem): Promise<void> {
  const { error } = await db().from("ephemeral_items").upsert({
    id: i.id, match_id: i.matchId, sender_id: i.senderId, recipient_id: i.recipientId,
    state: i.state, max_views: i.maxViews, views_used: i.viewsUsed,
    expires_at: iso(i.expiresAt), created_at: iso(i.createdAt),
  }, { onConflict: "id" });
  if (error) throw new Error(error.message);
}

export async function getItem(id: string): Promise<EphemeralItem | null> {
  const data = orThrow(await db().from("ephemeral_items").select("*").eq("id", id).maybeSingle());
  return data ? rowToItem(data) : null;
}

/** Remove the row; the storage blob keyed by id is deleted separately. */
export async function deleteItem(id: string): Promise<void> {
  const { error } = await db().from("ephemeral_items").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ── signaling relay (dev) ─────────────────────────────────────────────────––
export async function pushSignal(callId: string, msg: SignalMessage): Promise<number> {
  const data = orThrow(
    await db().from("signaling_messages").insert({ call_id: callId, msg }).select("seq").single(),
  );
  return Number((data as any).seq);
}

export async function getSignals(
  callId: string,
  since: number,
): Promise<{ messages: SignalMessage[]; last: number }> {
  const data = orThrow(
    await db().from("signaling_messages").select("seq, msg").eq("call_id", callId).gt("seq", since).order("seq", { ascending: true }),
  );
  const rows = (data ?? []) as { seq: number; msg: SignalMessage }[];
  const last = rows.length ? Number(rows[rows.length - 1].seq) : since;
  return { messages: rows.map((r) => r.msg), last };
}
