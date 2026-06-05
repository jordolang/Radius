"use client";

/**
 * ProfileEditor — the full profile page experience.
 *
 * Foregrounds the identity fields the product cares about (photos, pseudonym,
 * age/height/weight, hair/eye/skin, short bio lines), then keeps the
 * matching-critical descriptors (gender, who you're seeking, lifestyle, the
 * non-deception attestation) in a secondary section so the absolutes filter and
 * safety posture keep working. Everything renders client-side; it best-effort
 * loads any saved profile but stays usable even if that fetch fails.
 */

import { useEffect, useState } from "react";
import { PrimaryButton } from "@/components/ui";
import { PhotoGallery } from "@/components/profile/photo-gallery";
import {
  BIO_MESSAGE_MAX, MAX_BIO_MESSAGES, MAX_REVEAL_PHOTOS, type Profile,
} from "@/lib/profile";

const OPTS = {
  hairColor: ["black", "brown", "blonde", "red", "gray", "other", "none"],
  eyeColor: ["brown", "blue", "green", "hazel", "gray", "amber", "other"],
  skinTone: ["fair", "light", "medium", "tan", "brown", "deep"],
  gender: ["woman", "man", "nonbinary", "other"],
  seeking: ["woman", "man", "nonbinary", "anyone"],
  buildBand: ["petite", "lean", "average", "solid", "large"],
  bodyType: ["slim", "athletic", "average", "curvy", "muscular", "plus"],
  hairLength: ["bald", "short", "medium", "long"],
  freq: ["never", "socially", "regularly"],
  relationshipStatus: ["single", "open_relationship", "polyamorous", "separated"],
} as const;

const HEIGHTS: { value: number; label: string }[] = [];
for (let n = 48; n <= 84; n++) HEIGHTS.push({ value: n, label: `${Math.floor(n / 12)}'${n % 12}"` });

const readDataUrl = (file: File): Promise<string> =>
  new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });

interface ProfileEditorProps {
  userId: string;
  alias?: string;
}

export function ProfileEditor({ userId, alias: aliasProp }: ProfileEditorProps) {
  const [alias, setAlias] = useState(aliasProp ?? "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [revealPhotos, setRevealPhotos] = useState<string[]>([]);
  const [avatarBusy, setAvatarBusy] = useState(false);

  const [age, setAge] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightLbs, setWeightLbs] = useState("");
  const [f, setF] = useState<Record<string, string>>({});
  const [seeking, setSeeking] = useState<string[]>([]);
  const [attest, setAttest] = useState(false);
  const [bioMessages, setBioMessages] = useState<string[]>(["", "", ""]);

  const [errors, setErrors] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  // Best-effort prefill from any saved profile; tolerate a missing/erroring API.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/profile");
        if (!r.ok) return;
        const { profile } = (await r.json()) as { profile: Profile | null };
        if (cancelled || !profile) return;
        setAlias(profile.alias ?? aliasProp ?? "");
        setAvatarUrl(profile.avatarUrl ?? null);
        setRevealPhotos(profile.revealPhotos ?? []);
        setAge(profile.age ? String(profile.age) : "");
        setHeightIn(profile.heightInches ? String(profile.heightInches) : "");
        setWeightLbs(profile.weightLbs ? String(profile.weightLbs) : "");
        setSeeking(profile.seeking ?? []);
        setAttest(Boolean(profile.nonDeceptionAttestation));
        setBioMessages([...(profile.bioMessages ?? []), "", "", ""].slice(0, MAX_BIO_MESSAGES));
        setF({
          gender: profile.gender ?? "", buildBand: profile.buildBand ?? "", bodyType: profile.bodyType ?? "",
          hairColor: profile.hairColor ?? "", hairLength: profile.hairLength ?? "",
          eyeColor: profile.eyeColor ?? "", skinTone: profile.skinTone ?? "",
          smoking: profile.smoking ?? "", drinking: profile.drinking ?? "", cannabis: profile.cannabis ?? "",
          otherDrugs: profile.otherDrugs ?? "", relationshipStatus: profile.relationshipStatus ?? "",
          ethnicity: profile.ethnicity ?? "",
        });
      } catch {
        /* keep empty form */
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [aliasProp]);

  const onAvatarFile = async (file: File) => {
    setAvatarBusy(true);
    try {
      const b64 = await readDataUrl(file);
      const img = new Image();
      await new Promise((res) => { img.onload = res; img.src = b64; });
      const eyeBox = {
        x: img.width * 0.2, y: img.height * 0.28, width: img.width * 0.6, height: img.height * 0.18,
      };
      const r = await fetch("/api/profile/avatar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: b64, eyeBox }),
      });
      if (r.ok) { const d = await r.json(); setAvatarUrl(d.avatarUrl); }
      else setErrors(["Couldn't process that photo — try another."]);
    } finally {
      setAvatarBusy(false);
    }
  };

  const onRevealFile = async (file: File) => {
    if (revealPhotos.length >= MAX_REVEAL_PHOTOS) return;
    const b64 = await readDataUrl(file);
    setRevealPhotos((p) => [...p, b64].slice(0, MAX_REVEAL_PHOTOS));
  };

  const removeReveal = (index: number) =>
    setRevealPhotos((p) => p.filter((_, i) => i !== index));

  const setBio = (i: number, v: string) =>
    setBioMessages((p) => p.map((m, idx) => (idx === i ? v.slice(0, BIO_MESSAGE_MAX) : m)));

  const save = async () => {
    setSaving(true);
    setErrors([]);
    setSaved(false);
    try {
      const profile = {
        userId, alias, avatarUrl, revealPhotos, seeking,
        age: Number(age), heightInches: Number(heightIn), weightLbs: Number(weightLbs),
        gender: f.gender, buildBand: f.buildBand, bodyType: f.bodyType,
        hairColor: f.hairColor, hairLength: f.hairLength, eyeColor: f.eyeColor || undefined,
        skinTone: f.skinTone || undefined, smoking: f.smoking, drinking: f.drinking,
        cannabis: f.cannabis, otherDrugs: f.otherDrugs, relationshipStatus: f.relationshipStatus,
        nonDeceptionAttestation: attest, ethnicity: f.ethnicity || "prefer_not_to_say",
        bioMessages: bioMessages.map((m) => m.trim()).filter(Boolean),
      };
      const r = await fetch("/api/profile", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setErrors(d.errors ?? ["Could not save your profile."]);
        return;
      }
      setSaved(true);
    } catch {
      setErrors(["Could not reach the server."]);
    } finally {
      setSaving(false);
    }
  };

  const Select = ({ field, opts, label }: { field: string; opts: keyof typeof OPTS; label: string }) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <select value={f[field] ?? ""} onChange={(e) => set(field, e.target.value)} className="select">
        <option value="">—</option>
        {OPTS[opts].map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
      </select>
    </label>
  );

  if (loading) return <p className="faint text-sm">Loading your profile…</p>;

  return (
    <div className="space-y-6">
      <div className="card card-ember">
        <p className="help-text">
          Only your <span style={{ color: "var(--ember)" }}>main photo</span> appears
          on the map, and only as a cartoon. Your other photos stay private and
          blurred until you match and both agree to go further.
        </p>
      </div>

      <PhotoGallery
        avatarUrl={avatarUrl}
        revealPhotos={revealPhotos}
        onAvatarFile={onAvatarFile}
        onRevealFile={onRevealFile}
        onRemoveReveal={removeReveal}
        avatarBusy={avatarBusy}
      />

      <div>
        <span className="field-label">Pseudonym</span>
        <div className="mt-1 flex items-center justify-between rounded-lg border px-3 py-2" style={{ borderColor: "var(--border)" }}>
          <span style={{ color: "var(--ember)", fontFamily: "var(--font-display), Georgia, serif" }} className="text-lg">
            {alias || "—"}
          </span>
          <span className="faint text-xs">app-given · permanent</span>
        </div>
      </div>

      {/* Core stats */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="field-label">Age</span>
          <input type="number" inputMode="numeric" min={18} max={120} value={age}
            onChange={(e) => setAge(e.target.value)} className="input" placeholder="—" />
        </label>
        <label className="block">
          <span className="field-label">Height</span>
          <select value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="select">
            <option value="">—</option>
            {HEIGHTS.map((h) => <option key={h.value} value={h.value}>{h.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Weight</span>
          <input type="number" inputMode="numeric" min={50} max={700} value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)} className="input" placeholder="lbs" />
        </label>
      </div>

      {/* Appearance */}
      <div className="grid grid-cols-3 gap-3">
        <Select field="hairColor" opts="hairColor" label="Hair color" />
        <Select field="eyeColor" opts="eyeColor" label="Eye color" />
        <Select field="skinTone" opts="skinTone" label="Skin tone" />
      </div>

      {/* Bio messages */}
      <div>
        <span className="field-label">A few words (up to {MAX_BIO_MESSAGES})</span>
        <div className="mt-1 space-y-2">
          {bioMessages.map((m, i) => (
            <div key={i} className="relative">
              <input
                value={m}
                maxLength={BIO_MESSAGE_MAX}
                onChange={(e) => setBio(i, e.target.value)}
                className="input pr-12"
                placeholder={i === 0 ? "Something honest and short…" : "Add another line…"}
              />
              <span className="faint absolute right-3 top-1/2 -translate-y-1/2 text-[11px]">
                {m.length}/{BIO_MESSAGE_MAX}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Matching details — kept so the absolutes filter + safety still work */}
      <details className="card">
        <summary className="section-title cursor-pointer">More for matching</summary>
        <div className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Select field="gender" opts="gender" label="Gender" />
            <Select field="buildBand" opts="buildBand" label="Build" />
            <Select field="bodyType" opts="bodyType" label="Body type" />
            <Select field="hairLength" opts="hairLength" label="Hair length" />
            <Select field="smoking" opts="freq" label="Smoking" />
            <Select field="drinking" opts="freq" label="Drinking" />
            <Select field="cannabis" opts="freq" label="Cannabis" />
            <Select field="otherDrugs" opts="freq" label="Other drugs" />
            <Select field="relationshipStatus" opts="relationshipStatus" label="Relationship" />
          </div>

          <div>
            <span className="field-label">Seeking</span>
            <div className="mt-1 flex flex-wrap gap-2">
              {OPTS.seeking.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSeeking((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
                  className={`chip btn-sm ${seeking.includes(s) ? "chip-on" : ""}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
            <span>I&apos;m not deceiving a monogamous partner. (Cheating isn&apos;t allowed here.)</span>
          </label>
        </div>
      </details>

      {errors.length > 0 && <ul className="error-text">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}
      {saved && <p className="text-sm" style={{ color: "var(--ember)" }}>Profile saved.</p>}

      <PrimaryButton block onClick={save} disabled={saving} className="!py-4 text-base">
        {saving ? "Saving…" : "Save profile"}
      </PrimaryButton>
    </div>
  );
}
