"use client";

/**
 * PreferencesForm — the required "absolutes" panel.
 *
 * These are HARD limits. Anyone outside your ranges — or outside your accepted
 * hair / eye / skin lists — never matches you and never triggers an alert. The
 * filter is mutual, so you also won't surface to people whose absolutes you fall
 * outside of. Ranges use sliders; categorical traits use toggles where "all on"
 * means no restriction (turn a trait off to exclude it — e.g. turn off "blonde").
 */

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import {
  EYE_COLORS, FACT_BOUNDS, HAIR_COLORS, SKIN_TONES,
  type EyeColor, type HairColor, type SkinTone,
} from "@/lib/profile";
import { defaultPreferences, type Preferences } from "@/lib/preferences";

type RangeKey = "ageMin" | "ageMax" | "heightMinIn" | "heightMaxIn" | "weightMinLbs" | "weightMaxLbs";

const ftIn = (inches: number) => `${Math.floor(inches / 12)}'${inches % 12}"`;

export function PreferencesForm({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const [p, setP] = useState<Preferences>(() => defaultPreferences(userId));
  // Categorical selections default to "all on" (= no restriction).
  const [hair, setHair] = useState<Set<HairColor>>(new Set(HAIR_COLORS));
  const [eyes, setEyes] = useState<Set<EyeColor>>(new Set(EYE_COLORS));
  const [skin, setSkin] = useState<Set<SkinTone>>(new Set(SKIN_TONES));
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/preferences?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.preferences) return;
        const pref = d.preferences as Preferences;
        setP(pref);
        // A saved list means a restriction; absence means "all allowed".
        if (pref.hairColors?.length) setHair(new Set(pref.hairColors));
        if (pref.eyeColors?.length) setEyes(new Set(pref.eyeColors));
        if (pref.skinTones?.length) setSkin(new Set(pref.skinTones));
      })
      .catch(() => { /* keep defaults */ });
  }, [userId]);

  const setNum = (k: RangeKey, v: number) => setP((cur) => ({ ...cur, [k]: v }));

  const toggle = <T,>(set: Set<T>, setter: (s: Set<T>) => void, v: T) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  const save = async () => {
    setBusy(true);
    setErrors([]);
    setSaved(false);
    try {
      const r = await fetch("/api/preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...p, userId,
          hairColors: [...hair], eyeColors: [...eyes], skinTones: [...skin],
        }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setErrors(d.errors ?? ["Could not save"]); return; }
      setSaved(true);
      onSaved?.();
    } catch {
      setErrors(["Could not reach the server."]);
    } finally {
      setBusy(false);
    }
  };

  // A dual-thumb range built from two sliders; min is clamped at/below max.
  const slider = (
    label: string, minKey: RangeKey, maxKey: RangeKey,
    bound: { min: number; max: number }, fmt: (n: number) => string,
  ) => (
    <div className="card">
      <div className="flex items-baseline justify-between">
        <span className="section-title">{label}</span>
        <span className="text-sm" style={{ color: "var(--ember)" }}>
          {fmt(p[minKey])} – {fmt(p[maxKey])}
        </span>
      </div>
      <div className="mt-3 space-y-3">
        <input type="range" min={bound.min} max={bound.max} value={p[minKey]} className="abs-range"
          aria-label={`${label} minimum`}
          onChange={(e) => setNum(minKey, Math.min(Number(e.target.value), p[maxKey]))} />
        <input type="range" min={bound.min} max={bound.max} value={p[maxKey]} className="abs-range"
          aria-label={`${label} maximum`}
          onChange={(e) => setNum(maxKey, Math.max(Number(e.target.value), p[minKey]))} />
      </div>
    </div>
  );

  const chips = <T extends string>(
    label: string, all: readonly T[], selected: Set<T>, setter: (s: Set<T>) => void,
  ) => {
    const restricted = selected.size > 0 && selected.size < all.length;
    return (
      <div className="card">
        <div className="flex items-baseline justify-between">
          <span className="section-title">{label}</span>
          <span className="faint text-xs">{restricted ? `${selected.size}/${all.length}` : "No limit"}</span>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {all.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(selected, setter as (s: Set<T>) => void, o)}
              className={`chip btn-sm ${selected.has(o) ? "chip-on" : ""}`}
              aria-pressed={selected.has(o)}
            >
              {o}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-3">
      <div className="card card-ember">
        <p className="help-text">
          Absolutes are hard limits. People outside any range — or outside the
          traits you keep on below — won&apos;t match you or appear in your radius,
          and because it&apos;s mutual, you won&apos;t appear to them either. Leave
          a trait fully on for &quot;no preference&quot;; turn one off to exclude it.
        </p>
      </div>

      {slider("Age", "ageMin", "ageMax", FACT_BOUNDS.age, (n) => `${n}`)}
      {slider("Height", "heightMinIn", "heightMaxIn", FACT_BOUNDS.heightInches, ftIn)}
      {slider("Weight", "weightMinLbs", "weightMaxLbs", FACT_BOUNDS.weightLbs, (n) => `${n} lb`)}

      {chips("Hair color", HAIR_COLORS, hair, setHair as (s: Set<HairColor>) => void)}
      {chips("Eye color", EYE_COLORS, eyes, setEyes as (s: Set<EyeColor>) => void)}
      {chips("Skin tone", SKIN_TONES, skin, setSkin as (s: Set<SkinTone>) => void)}

      {errors.length > 0 && <ul className="error-text">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
      {saved && <p className="text-sm" style={{ color: "var(--ember)" }}>Absolutes saved.</p>}

      <PrimaryButton block onClick={save} disabled={busy} className="!py-4 text-base">
        {busy ? "Saving…" : "Save my absolutes"}
      </PrimaryButton>
    </div>
  );
}
