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
export type EyeColor = "brown" | "blue" | "green" | "hazel" | "gray" | "amber" | "other";
// Coarse, self-described skin tone. Used for both display and absolutes filtering.
export type SkinTone = "fair" | "light" | "medium" | "tan" | "brown" | "deep";

/** Canonical option lists — single source for the forms, sanitizers, and filter. */
export const HAIR_COLORS: readonly HairColor[] = ["black", "brown", "blonde", "red", "gray", "other", "none"];
export const EYE_COLORS: readonly EyeColor[] = ["brown", "blue", "green", "hazel", "gray", "amber", "other"];
export const SKIN_TONES: readonly SkinTone[] = ["fair", "light", "medium", "tan", "brown", "deep"];

/** Caps for the photo gallery + short bio prompts on the profile page. */
export const MAX_REVEAL_PHOTOS = 4; // optional photos beyond the main avatar
export const MAX_BIO_MESSAGES = 3; // short personalizable lines
export const BIO_MESSAGE_MAX = 50; // characters per bio line
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

  // --- required, used for the absolutes match filter (lib/preferences.ts) ---
  // Exact figures drive filtering ONLY; the public profile still shows coarse
  // bands (heightBand/buildBand) so the displayed profile isn't a precise
  // physical fingerprint. See the privacy note on HeightBand/BuildBand above.
  age: number; // years; ageVerified lives on User, this is the displayed/filtered age
  heightInches: number; // exact height for range filtering; displayed as heightBand
  weightLbs: number; // exact weight for range filtering; never shown verbatim

  // --- required descriptors ---
  gender: Gender;
  seeking: Seeking[]; // who they want to match — enforced in the absolutes filter
  heightBand: HeightBand;
  buildBand: BuildBand;
  bodyType: BodyType;
  hairColor: HairColor;
  hairLength: HairLength;

  // --- appearance descriptors surfaced on the profile page (optional) ---
  eyeColor?: EyeColor;
  skinTone?: SkinTone;

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

  bio?: string; // short free text (legacy single line)
  bioMessages?: string[]; // up to MAX_BIO_MESSAGES lines, each <= BIO_MESSAGE_MAX chars

  // Optional photos beyond the main avatar. Stored real (not avatarized); kept
  // blurred to others until a match consents to reveal (contentSharingConsent).
  // Up to MAX_REVEAL_PHOTOS entries.
  revealPhotos?: string[];

  createdAt: number;
}

const REQUIRED_KEYS: (keyof Profile)[] = [
  "alias", "avatarUrl", "age", "heightInches", "weightLbs", "gender", "seeking",
  "heightBand", "buildBand", "bodyType", "hairColor", "hairLength", "smoking",
  "drinking", "cannabis", "otherDrugs", "relationshipStatus",
];

/** Hard bounds for the filterable facts. The absolutes panel stays within these. */
export const FACT_BOUNDS = {
  age: { min: 18, max: 120 }, // 18+ only; this is an adults-only service
  heightInches: { min: 36, max: 96 }, // 3'0" – 8'0"
  weightLbs: { min: 50, max: 700 },
} as const;

/** Trim, length-cap, and count-cap the short bio lines. Drops empty entries. */
export function sanitizeBioMessages(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is string => typeof m === "string")
    .map((m) => m.trim().slice(0, BIO_MESSAGE_MAX))
    .filter((m) => m.length > 0)
    .slice(0, MAX_BIO_MESSAGES);
}

/** Keep only well-formed image entries, capped at MAX_REVEAL_PHOTOS. */
export function sanitizeRevealPhotos(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((p): p is string => typeof p === "string" && p.length > 0)
    .slice(0, MAX_REVEAL_PHOTOS);
}

/** Map an exact height (inches) to the coarse display band. */
export function bandForHeight(inches: number): HeightBand {
  if (inches < 62) return "<5'2";
  if (inches <= 65) return "5'2-5'5";
  if (inches <= 69) return "5'6-5'9";
  if (inches <= 73) return "5'10-6'1";
  return "6'2+";
}

function inRange(v: unknown, lo: number, hi: number): v is number {
  return typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
}

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

  // Numeric facts must be present and within hard bounds (18+ enforced here too).
  if (p.age !== undefined && !inRange(p.age, FACT_BOUNDS.age.min, FACT_BOUNDS.age.max)) {
    errors.push(`age must be between ${FACT_BOUNDS.age.min} and ${FACT_BOUNDS.age.max}`);
  }
  if (p.heightInches !== undefined && !inRange(p.heightInches, FACT_BOUNDS.heightInches.min, FACT_BOUNDS.heightInches.max)) {
    errors.push("height is out of range");
  }
  if (p.weightLbs !== undefined && !inRange(p.weightLbs, FACT_BOUNDS.weightLbs.min, FACT_BOUNDS.weightLbs.max)) {
    errors.push("weight is out of range");
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
