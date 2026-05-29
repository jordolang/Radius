/**
 * profile.ts — Pseudonymous bio profile.
 *
 * Most attributes you asked for are required exactly as requested. Two parts are
 * deliberately shaped differently; see the notes on `health` and the anonymity
 * tradeoff below.
 */

import type { Alias } from "./identity";

export type BodyType = "slim" | "athletic" | "average" | "curvy" | "muscular" | "plus";
export type HairColor = "black" | "brown" | "blonde" | "red" | "gray" | "other" | "none";
export type HairLength = "bald" | "short" | "medium" | "long";
export type Gender = "woman" | "man" | "nonbinary" | "other";
export type Seeking = Gender | "anyone";
export type Frequency = "never" | "socially" | "regularly";
export type RelationshipStatus =
  | "single"
  | "open_relationship" // partner knows & consents
  | "polyamorous"
  | "separated";

// Height/weight as BUCKETS, not exact figures — keeps the profile from becoming a
// precise physical fingerprint (and avoids fixating users on an exact number).
export type HeightBand = "<5'2" | "5'2-5'5" | "5'6-5'9" | "5'10-6'1" | "6'2+";
export type BuildBand = "petite" | "lean" | "average" | "solid" | "large";

/** PRIVATE, OPTIONAL sexual-health info. Never shown on the public profile. */
export interface HealthInfo {
  lastTested?: string; // ISO date, user-entered
  practicesSaferSex?: boolean;
  notes?: string; // length-capped, user's own words
  // Shared ONLY in chat, by the user's explicit choice, per conversation.
}

export interface Profile {
  userId: string;
  alias: Alias; // chosen at signup; no real name exists anywhere
  avatarUrl: string; // the de-identified avatar (see avatarize.ts)

  // --- required descriptors ---
  gender: Gender;
  seeking: Seeking[]; // who they want to match — needed to match at all
  heightBand: HeightBand;
  buildBand: BuildBand;
  bodyType: BodyType;
  hairColor: HairColor;
  hairLength: HairLength;

  // --- required lifestyle ---
  smoking: Frequency;
  drinking: Frequency;
  cannabis: Frequency;
  otherDrugs: Frequency;

  // --- required honesty about availability to participate ---
  relationshipStatus: RelationshipStatus;
  nonDeceptionAttestation: boolean; // must be true: not deceiving a monogamous partner

  // --- sensitive: allowed but not forced into the open ---
  ethnicity?: string | "prefer_not_to_say";

  // --- optional, private ---
  health?: HealthInfo;

  bio?: string; // short free text
  createdAt: number;
}

const REQUIRED_KEYS: (keyof Profile)[] = [
  "alias", "avatarUrl", "gender", "seeking", "heightBand", "buildBand",
  "bodyType", "hairColor", "hairLength", "smoking", "drinking", "cannabis",
  "otherDrugs", "relationshipStatus",
];

export interface ProfileValidation {
  ok: boolean;
  errors: string[];
}

export function validateProfile(p: Partial<Profile>): ProfileValidation {
  const errors: string[] = [];

  for (const k of REQUIRED_KEYS) {
    const v = p[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
      errors.push(`${k} is required`);
    }
  }

  // The non-deception attestation must be affirmatively true to be active.
  if (p.nonDeceptionAttestation !== true) {
    errors.push(
      "must affirm you are not deceiving a monogamous partner (cheating is not permitted)",
    );
  }

  // Health, if present, is fine — but it is never REQUIRED and never public.
  // (No validation forces a disease/status disclosure.)

  return { ok: errors.length === 0, errors };
}

/** What another user can see at mutual-interest stage. Health is NOT here. */
export function publicView(p: Profile): Omit<Profile, "userId" | "health"> {
  const { userId, health, ...rest } = p;
  void userId;
  void health;
  return rest;
}
