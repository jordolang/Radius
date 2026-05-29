/**
 * store.ts — Process-memory store backing every API route during development.
 *
 * SWAP FOR A REAL DB before any real use (Vercel Postgres / Neon recommended).
 * Privacy-preserving by construction: only coarse cells, aliases, booleans,
 * timestamps, and de-identified avatar URLs. No raw coordinates, no real names,
 * no recordings, no public health/disease fields.
 */

import type { PresenceStore } from "./presence";
import { emptyTrustState } from "./safety";
import { emptyReliability, type PlannedPresence, type PlannerReliability } from "./planahead";
import type { PairAlertLog } from "./beacon";
import type { EphemeralItem } from "./ephemeral";
import type { Match, Presence, SafetyReport, TrustState, UserId } from "./types";
import type { Profile } from "./profile";
import type { Alias } from "./identity";

const presences = new Map<UserId, Presence>();
const presenceMode = new Map<UserId, "passive" | "beacon">();
const matches = new Map<string, Match>();
const profiles = new Map<UserId, Profile>();
const plans = new Map<string, PlannedPresence>(); // key: `${userId}:${createdAt}`
const reliability = new Map<UserId, PlannerReliability>();
const trust = new Map<UserId, TrustState>();
const ephemeral = new Map<string, EphemeralItem>();
const reports: SafetyReport[] = [];
const blocks = new Set<string>();
const aliasesInUse = new Set<Alias>();
let beaconLog: PairAlertLog = {};

const blockKey = (a: UserId, b: UserId) => [a, b].sort().join("|");

// trust
export const getTrust = (id: UserId): TrustState => trust.get(id) ?? emptyTrustState(id);
export const setTrust = (s: TrustState) => void trust.set(s.userId, s);

// blocks
export const block = (a: UserId, b: UserId) => void blocks.add(blockKey(a, b));
export const isBlocked = (a: UserId, b: UserId) => blocks.has(blockKey(a, b));

// matches
export const getMatch = (id: string) => matches.get(id);
export const putMatch = (m: Match) => void matches.set(m.id, m);

// profiles
export const getProfile = (id: UserId) => profiles.get(id);
export const putProfile = (p: Profile) => void profiles.set(p.userId, p);

// aliases
export const aliasTaken = (): ReadonlySet<Alias> => aliasesInUse;
export const claimAliasInUse = (a: Alias) => void aliasesInUse.add(a);

// plans + reliability
export const putPlan = (key: string, p: PlannedPresence) => void plans.set(key, p);
export const getPlan = (key: string) => plans.get(key);
export const allPlans = () => [...plans.entries()];
export const getReliability = (id: UserId) => reliability.get(id) ?? emptyReliability(id);
export const setReliability = (r: PlannerReliability) => void reliability.set(r.userId, r);

// beacon
export const getBeaconLog = () => beaconLog;
export const setBeaconLog = (l: PairAlertLog) => { beaconLog = l; };
export const getMode = (id: UserId) => presenceMode.get(id) ?? "passive";
export const setMode = (id: UserId, m: "passive" | "beacon") => void presenceMode.set(id, m);

// ephemeral
export const getItem = (id: string) => ephemeral.get(id);
export const putItem = (i: EphemeralItem) => void ephemeral.set(i.id, i);
export const deleteItemBlob = (id: string) => void ephemeral.delete(id); // "destroyed" => blob gone

// reports
export const addReport = (r: SafetyReport) => void reports.push(r);
export const allReports = () => [...reports];

export const presenceStore: PresenceStore = {
  async upsert(p) { presences.set(p.userId, p); },
  async remove(id) { presences.delete(id); },
  async get(id) { return presences.get(id) ?? null; },
  async all() { return [...presences.values()]; },
  async isBlockedBetween(a, b) { return blocks.has(blockKey(a, b)); },
  async trustStatus(id) { return getTrust(id).status; },
};
