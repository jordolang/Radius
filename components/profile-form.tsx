"use client";

import { useState } from "react";
import { PrimaryButton } from "@/components/ui";

const OPTS = {
  gender: ["woman", "man", "nonbinary", "other"],
  seeking: ["woman", "man", "nonbinary", "anyone"],
  buildBand: ["petite", "lean", "average", "solid", "large"],
  bodyType: ["slim", "athletic", "average", "curvy", "muscular", "plus"],
  hairColor: ["black", "brown", "blonde", "red", "gray", "other", "none"],
  hairLength: ["bald", "short", "medium", "long"],
  freq: ["never", "socially", "regularly"],
  relationshipStatus: ["single", "open_relationship", "polyamorous", "separated"],
};

// Height as a ft'in" picker; the coarse display band is derived server-side.
const HEIGHTS: { value: number; label: string }[] = [];
for (let n = 48; n <= 84; n++) HEIGHTS.push({ value: n, label: `${Math.floor(n / 12)}'${n % 12}"` });

export function ProfileForm({ userId, alias, onSaved }: { userId: string; alias: string; onSaved?: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  const [seeking, setSeeking] = useState<string[]>([]);
  const [attest, setAttest] = useState(false);
  const [age, setAge] = useState("");
  const [heightIn, setHeightIn] = useState("");
  const [weightLbs, setWeightLbs] = useState("");

  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));

  const onPhoto = async (file: File) => {
    setWorking(true);
    const b64 = await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.readAsDataURL(file); });
    // Default eye box (center band). A production build detects eyes or lets the user drag the mask.
    const eyeBox = { x: 0, y: 0, width: 1000, height: 1000 };
    const img = new Image();
    await new Promise((res) => { img.onload = res; img.src = b64; });
    eyeBox.x = img.width * 0.2; eyeBox.y = img.height * 0.28; eyeBox.width = img.width * 0.6; eyeBox.height = img.height * 0.18;
    const r = await fetch("/api/profile/avatar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ imageBase64: b64, eyeBox }) });
    const data = await r.json();
    setAvatarUrl(data.avatarUrl);
    setWorking(false);
  };

  const save = async () => {
    const profile = { userId, alias, avatarUrl, seeking,
      age: Number(age), heightInches: Number(heightIn), weightLbs: Number(weightLbs),
      gender: f.gender, buildBand: f.buildBand, bodyType: f.bodyType,
      hairColor: f.hairColor, hairLength: f.hairLength, smoking: f.smoking, drinking: f.drinking,
      cannabis: f.cannabis, otherDrugs: f.otherDrugs, relationshipStatus: f.relationshipStatus,
      nonDeceptionAttestation: attest, ethnicity: f.ethnicity || "prefer_not_to_say" };
    const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    if (!r.ok) { const d = await r.json(); setErrors(d.errors ?? ["Could not save"]); return; }
    onSaved?.();
  };

  const Select = ({ field, opts, label }: { field: string; opts: keyof typeof OPTS; label: string }) => (
    <label className="block">
      <span className="field-label">{label}</span>
      <select value={f[field] ?? ""} onChange={(e) => set(field, e.target.value)} className="select">
        <option value="" className="bg-ink">—</option>
        {OPTS[opts].map((o) => <option key={o} value={o} className="bg-ink">{o.replace(/_/g, " ")}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div
          className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border-ember)" }}
        >
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="faint text-xs">avatar</span>}
        </div>
        <div>
          <label className="link-ember cursor-pointer">
            {working ? "Disguising…" : "Upload a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          </label>
          <p className="help-text mt-1">
            We strip location data and turn it into a masked illustration. It hints at your look without identifying you.
          </p>
        </div>
      </div>

      <p className="text-sm">You&apos;ll be known as <span style={{ color: "var(--ember)" }}>{alias}</span>.</p>

      {/* About you — exact figures power the absolutes match filter; the public
          profile only ever shows coarse bands derived from these. */}
      <div className="grid grid-cols-3 gap-3">
        <label className="block">
          <span className="field-label">Age</span>
          <input type="number" inputMode="numeric" min={18} max={120} value={age}
            onChange={(e) => setAge(e.target.value)} className="input" placeholder="—" />
        </label>
        <label className="block">
          <span className="field-label">Height</span>
          <select value={heightIn} onChange={(e) => setHeightIn(e.target.value)} className="select">
            <option value="" className="bg-ink">—</option>
            {HEIGHTS.map((h) => <option key={h.value} value={h.value} className="bg-ink">{h.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="field-label">Weight</span>
          <input type="number" inputMode="numeric" min={50} max={700} value={weightLbs}
            onChange={(e) => setWeightLbs(e.target.value)} className="input" placeholder="lbs" />
        </label>
      </div>
      <p className="help-text">
        Your exact age, height, and weight are used only to match against people&apos;s
        absolutes — never shown verbatim. Others see coarse bands.
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Select field="gender" opts="gender" label="Gender" />
        <Select field="buildBand" opts="buildBand" label="Build" />
        <Select field="bodyType" opts="bodyType" label="Body type" />
        <Select field="hairColor" opts="hairColor" label="Hair color" />
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

      <p className="help-text">
        Sexual-health details are optional and private — you can choose to share them later in chat. We never put health status on a public profile.
      </p>

      {errors.length > 0 && <ul className="error-text">{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}

      <PrimaryButton block onClick={save}>
        Save profile
      </PrimaryButton>
    </div>
  );
}
