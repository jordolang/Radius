/**
 * preferences.ts — Each user's hard "absolutes" for who may match them.
 *
 * This is a HARD filter, not a soft ranking. If a nearby, available person falls
 * outside your absolutes — or you fall outside theirs — no candidate is formed,
 * no beacon fires, and neither of you ever appears to the other. Example: a user
 * whose absolutes are age 18–48, height 4'0"–6'2", weight 0–250lb will never be
 * alerted about (or visible to) someone aged 50 or 260lb, and vice versa.
 *
 * Directionality is MUTUAL by design: both people must satisfy each other's
 * absolutes. This matches the app's consent posture (no one-sided exposure) and
 * avoids alerting people who would instantly reject one another.
 *
 * Privacy note: absolutes are compared against EXACT facts (age/height/weight)
 * server-side, but those exact figures are never shown to the other user — the
 * displayed profile stays coarse (see profile.ts bands).
 */

import {
  EYE_COLORS, FACT_BOUNDS, HAIR_COLORS, SKIN_TONES,
  type EyeColor, type Gender, type HairColor, type Profile, type Seeking, type SkinTone,
} from "./profile";

/**
 * Normalize a categorical allow-list: keep only valid members, dedupe, and treat
 * "all selected" the same as "no restriction" (undefined) to keep matching cheap
 * and avoid storing a redundant full list.
 */
function sanitizeAllowList<T extends string>(input: unknown, all: readonly T[]): T[] | undefined {
  if (!Array.isArray(input)) return undefined;
  const valid = [...new Set(input.filter((v): v is T => all.includes(v as T)))];
  if (valid.length === 0 || valid.length === all.length) return undefined;
  return valid;
}

/** Pull the categorical absolutes off a request body, validated against the enums. */
export function sanitizeCategoricalPreferences(body: Partial<Preferences>): {
  hairColors?: HairColor[]; eyeColors?: EyeColor[]; skinTones?: SkinTone[];
} {
  return {
    hairColors: sanitizeAllowList(body.hairColors, HAIR_COLORS),
    eyeColors: sanitizeAllowList(body.eyeColors, EYE_COLORS),
    skinTones: sanitizeAllowList(body.skinTones, SKIN_TONES),
  };
}

export interface Preferences {
  userId: string;
  ageMin: number;
  ageMax: number;
  heightMinIn: number;
  heightMaxIn: number;
  weightMinLbs: number;
  weightMaxLbs: number;
  // Categorical absolutes (allow-lists). Undefined/empty = no restriction; a
  // populated list means "only these are acceptable" — so deselecting "blonde"
  // from a full hair list excludes blondes, and keeping only "fair" restricts to
  // that skin tone. Compared against the candidate's profile values.
  hairColors?: HairColor[];
  eyeColors?: EyeColor[];
  skinTones?: SkinTone[];
  createdAt: number;
}

/** The minimal set of facts the absolutes filter compares against. */
export interface MatchFacts {
  age: number;
  heightInches: number;
  weightLbs: number;
  gender: Gender;
  seeking: Seeking[];
  hairColor: HairColor;
  eyeColor?: EyeColor;
  skinTone?: SkinTone;
}

export function factsFromProfile(p: Profile): MatchFacts {
  return {
    age: p.age,
    heightInches: p.heightInches,
    weightLbs: p.weightLbs,
    gender: p.gender,
    seeking: p.seeking,
    hairColor: p.hairColor,
    eyeColor: p.eyeColor,
    skinTone: p.skinTone,
  };
}

/** Sensible, wide-open defaults so the panel starts permissive, not empty. */
export function defaultPreferences(userId: string, now = Date.now()): Preferences {
  return {
    userId,
    ageMin: FACT_BOUNDS.age.min,
    ageMax: FACT_BOUNDS.age.max,
    heightMinIn: FACT_BOUNDS.heightInches.min,
    heightMaxIn: FACT_BOUNDS.heightInches.max,
    weightMinLbs: FACT_BOUNDS.weightLbs.min,
    weightMaxLbs: FACT_BOUNDS.weightLbs.max,
    createdAt: now,
  };
}

export interface PreferenceValidation {
  ok: boolean;
  errors: string[];
}

export function validatePreferences(p: Partial<Preferences>): PreferenceValidation {
  const errors: string[] = [];
  const checkRange = (
    label: string,
    min: unknown,
    max: unknown,
    bound: { min: number; max: number },
  ) => {
    const lo = Number(min);
    const hi = Number(max);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) {
      errors.push(`${label} range is required`);
      return;
    }
    if (lo > hi) errors.push(`${label} minimum can't exceed its maximum`);
    if (lo < bound.min || hi > bound.max) {
      errors.push(`${label} must stay within ${bound.min}–${bound.max}`);
    }
  };

  checkRange("Age", p.ageMin, p.ageMax, FACT_BOUNDS.age);
  checkRange("Height", p.heightMinIn, p.heightMaxIn, FACT_BOUNDS.heightInches);
  checkRange("Weight", p.weightMinLbs, p.weightMaxLbs, FACT_BOUNDS.weightLbs);

  return { ok: errors.length === 0, errors };
}

/** Does this seeking list welcome the given gender? "anyone" matches all. */
export function wantsGender(seeking: Seeking[], gender: Gender): boolean {
  return seeking.includes("anyone") || seeking.includes(gender);
}

/**
 * An allow-list gate. No restriction when the list is missing/empty, or when the
 * candidate hasn't disclosed this (optional) attribute — we don't hard-exclude on
 * missing data. Otherwise the candidate's value must be in the allowed list.
 */
function allowedBy<T>(allowed: T[] | undefined, value: T | undefined): boolean {
  if (!allowed || allowed.length === 0) return true;
  if (value === undefined) return true;
  return allowed.includes(value);
}

/** One direction: do `candidate`'s facts fall inside `seeker`'s absolutes? */
export function passesAbsolutes(seeker: Preferences, candidate: MatchFacts): boolean {
  return (
    candidate.age >= seeker.ageMin &&
    candidate.age <= seeker.ageMax &&
    candidate.heightInches >= seeker.heightMinIn &&
    candidate.heightInches <= seeker.heightMaxIn &&
    candidate.weightLbs >= seeker.weightMinLbs &&
    candidate.weightLbs <= seeker.weightMaxLbs &&
    allowedBy(seeker.hairColors, candidate.hairColor) &&
    allowedBy(seeker.eyeColors, candidate.eyeColor) &&
    allowedBy(seeker.skinTones, candidate.skinTone)
  );
}

export interface Party {
  pref: Preferences;
  facts: MatchFacts;
}

/**
 * The full gate between two people. True only if BOTH sit inside the other's
 * absolutes AND each one's gender is welcomed by the other's seeking list.
 */
export function mutuallyCompatible(a: Party, b: Party): boolean {
  return (
    passesAbsolutes(a.pref, b.facts) &&
    passesAbsolutes(b.pref, a.facts) &&
    wantsGender(a.facts.seeking, b.facts.gender) &&
    wantsGender(b.facts.seeking, a.facts.gender)
  );
}
