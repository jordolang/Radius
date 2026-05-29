"use client";
import { useEffect, useState } from "react";
import { ProfileForm } from "@/components/profile-form";
import { demoUserId } from "@/lib/demo-user";

export default function Onboarding() {
  const [uid, setUid] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [alias, setAlias] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => { const id = demoUserId(); setUid(id);
    fetch(`/api/identity?userId=${id}`).then((r) => r.json()).then((o) => setChoices(o.choices ?? [])); }, []);

  const claim = async (pick: string) => {
    const r = await fetch("/api/identity", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, choices, pick }) });
    const d = await r.json();
    if (r.ok) setAlias(d.alias);
  };

  if (done) return <p className="text-sm">Profile saved. You're set — head back to go available.</p>;

  return (
    <div>
      <h1 className="mb-4 text-3xl">Set up your profile</h1>
      {!alias ? (
        <>
          <p className="mb-3 text-sm" style={{ color: "rgba(232,200,180,0.6)" }}>
            Pick a pseudonym. Your real name is never stored or shown.
          </p>
          <div className="flex flex-wrap gap-2">
            {choices.map((c) => (
              <button key={c} onClick={() => claim(c)} className="rounded-full border px-4 py-2 text-sm"
                style={{ borderColor: "rgba(214,122,72,0.3)" }}>{c}</button>
            ))}
          </div>
        </>
      ) : (
        <ProfileForm userId={uid} alias={alias} onSaved={() => setDone(true)} />
      )}
    </div>
  );
}
