"use client";
import { useState } from "react";

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

  if (sent) return <p className="text-sm" style={{ color: "rgba(232,200,180,0.6)" }}>Thanks — this goes privately to our safety team. It never appears on anyone's profile.</p>;

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium">Report a safety concern</p>
      {CATEGORIES.map((c) => (
        <button key={c.value} onClick={() => setCat(c.value)}
          className="block w-full rounded-xl border px-4 py-2.5 text-left text-sm"
          style={{ borderColor: cat === c.value ? "rgba(232,145,91,0.5)" : "rgba(255,255,255,0.1)",
                   background: cat === c.value ? "rgba(232,145,91,0.1)" : "transparent" }}>
          {c.label}
        </button>
      ))}
      <textarea value={note} onChange={(e) => setNote(e.target.value.slice(0, 1000))}
        placeholder="Anything else (optional)" rows={3}
        className="w-full rounded-xl border bg-transparent px-3 py-2 text-sm"
        style={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <button onClick={submit} disabled={!cat}
        className="w-full rounded-full py-2.5 text-sm font-medium disabled:opacity-40"
        style={{ background: "linear-gradient(180deg,#ef9a63,#d6713f)", color: "#1a0e08" }}>
        Send privately
      </button>
    </div>
  );
}
