"use client";
import { useState } from "react";
import { PrimaryButton } from "@/components/ui";

const CATEGORIES: { value: string; label: string }[] = [
  { value: "no_show_or_misrepresented", label: "Didn't match their profile / no-show" },
  { value: "ignored_boundaries", label: "Pushed past a boundary" },
  { value: "coercion_or_pressure", label: "Coercion or pressure" },
  { value: "threats_or_intimidation", label: "Threats or intimidation" },
  { value: "unwanted_contact_after", label: "Unwanted contact afterward" },
  { value: "felt_unsafe_other", label: "Felt unsafe (other)" },
];

export function SafetyReport({ reporterId, reportedId, onDone }: { reporterId: string; reportedId: string; onDone?: () => void }) {
  const [cat, setCat] = useState("");
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);

  const submit = async () => {
    await fetch("/api/safety", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reporterId, reportedId, category: cat, note }) });
    setSent(true); onDone?.();
  };

  if (sent) return <p className="muted text-sm">Thanks — this goes privately to our safety team. It never appears on anyone&apos;s profile.</p>;

  return (
    <div className="space-y-2">
      <p className="section-title">Report a safety concern</p>
      {CATEGORIES.map((c) => (
        <button key={c.value} onClick={() => setCat(c.value)}
          className={`block w-full rounded-xl border px-4 py-2.5 text-left text-sm transition-colors ${cat === c.value ? "chip-on" : ""}`}
          style={cat === c.value ? undefined : { borderColor: "var(--border)" }}>
          {c.label}
        </button>
      ))}
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))}
        placeholder="Anything else (optional)" rows={3} className="textarea" />
      <PrimaryButton block disabled={!cat} onClick={submit}>
        Send privately
      </PrimaryButton>
    </div>
  );
}
