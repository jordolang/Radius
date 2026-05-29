"use client";

import { useState } from "react";

const OPTS = {
  gender: ["woman", "man", "nonbinary", "other"],
  seeking: ["woman", "man", "nonbinary", "anyone"],
  heightBand: ["<5'2", "5'2-5'5", "5'6-5'9", "5'10-6'1", "6'2+"],
  buildBand: ["petite", "lean", "average", "solid", "large"],
  bodyType: ["slim", "athletic", "average", "curvy", "muscular", "plus"],
  hairColor: ["black", "brown", "blonde", "red", "gray", "other", "none"],
  hairLength: ["bald", "short", "medium", "long"],
  freq: ["never", "socially", "regularly"],
  relationshipStatus: ["single", "open_relationship", "polyamorous", "separated"],
};

export function ProfileForm({ userId, alias, onSaved }: { userId: string; alias: string; onSaved?: () => void }) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [f, setF] = useState<Record<string, string>>({});
  const [seeking, setSeeking] = useState<string[]>([]);
  const [attest, setAttest] = useState(false);

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
      gender: f.gender, heightBand: f.heightBand, buildBand: f.buildBand, bodyType: f.bodyType,
      hairColor: f.hairColor, hairLength: f.hairLength, smoking: f.smoking, drinking: f.drinking,
      cannabis: f.cannabis, otherDrugs: f.otherDrugs, relationshipStatus: f.relationshipStatus,
      nonDeceptionAttestation: attest, ethnicity: f.ethnicity || "prefer_not_to_say" };
    const r = await fetch("/api/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(profile) });
    if (!r.ok) { const d = await r.json(); setErrors(d.errors ?? ["Could not save"]); return; }
    onSaved?.();
  };

  const Select = ({ field, opts, label }: { field: string; opts: keyof typeof OPTS; label: string }) => (
    <label className="block">
      <span className="text-xs" style={{ color: "rgba(232,200,180,0.6)" }}>{label}</span>
      <select value={f[field] ?? ""} onChange={(e) => set(field, e.target.value)}
        className="mt-1 w-full rounded-lg border bg-transparent px-3 py-2 text-sm" style={{ borderColor: "rgba(255,255,255,0.12)", color: "#f6ece4" }}>
        <option value="" className="bg-ink">—</option>
        {OPTS[opts].map((o) => <option key={o} value={o} className="bg-ink">{o.replace(/_/g, " ")}</option>)}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border" style={{ borderColor: "rgba(214,122,72,0.3)" }}>
          {avatarUrl ? <img src={avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-xs" style={{ color: "rgba(232,200,180,0.4)" }}>avatar</span>}
        </div>
        <div>
          <label className="cursor-pointer text-sm underline" style={{ color: "#e8915b" }}>
            {working ? "Disguising…" : "Upload a photo"}
            <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && onPhoto(e.target.files[0])} />
          </label>
          <p className="mt-1 text-xs" style={{ color: "rgba(232,200,180,0.45)" }}>
            We strip location data and turn it into a masked illustration. It hints at your look without identifying you.
          </p>
        </div>
      </div>

      <p className="text-sm">You'll be known as <span style={{ color: "#e8915b" }}>{alias}</span>.</p>

      <div className="grid grid-cols-2 gap-3">
        <Select field="gender" opts="gender" label="Gender" />
        <Select field="heightBand" opts="heightBand" label="Height" />
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
        <span className="text-xs" style={{ color: "rgba(232,200,180,0.6)" }}>Seeking</span>
        <div className="mt-1 flex flex-wrap gap-2">
          {OPTS.seeking.map((s) => (
            <button key={s} onClick={() => setSeeking((p) => p.includes(s) ? p.filter((x) => x !== s) : [...p, s])}
              className="rounded-full border px-3 py-1 text-sm"
              style={{ borderColor: seeking.includes(s) ? "rgba(232,145,91,0.5)" : "rgba(255,255,255,0.12)", background: seeking.includes(s) ? "rgba(232,145,91,0.12)" : "transparent" }}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" checked={attest} onChange={(e) => setAttest(e.target.checked)} className="mt-1" />
        <span>I'm not deceiving a monogamous partner. (Cheating isn't allowed here.)</span>
      </label>

      <p className="text-xs" style={{ color: "rgba(232,200,180,0.45)" }}>
        Sexual-health details are optional and private — you can choose to share them later in chat. We never put health status on a public profile.
      </p>

      {errors.length > 0 && <ul className="text-xs" style={{ color: "#f2a08a" }}>{errors.map((e) => <li key={e}>• {e}</li>)}</ul>}

      <button onClick={save} className="w-full rounded-full py-3 text-sm font-medium" style={{ background: "linear-gradient(180deg,#ef9a63,#d6713f)", color: "#1a0e08" }}>
        Save profile
      </button>
    </div>
  );
}
