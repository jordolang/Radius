"use client";
import { useEffect, useState } from "react";
import { demoUserId } from "@/lib/demo-user";
import { toCoarseCell } from "@/lib/geo";

export default function Plan() {
  const [uid, setUid] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => setUid(demoUserId()), []);

  const createPlan = async () => {
    setMsg(null);
    const pos = await new Promise<GeolocationPosition>((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false }));
    const cell = toCoarseCell(pos.coords.latitude, pos.coords.longitude); // coarsened on-device
    const now = Date.now();
    const r = await fetch("/api/plan", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: uid, cell, windowStart: now + 2 * 3600000, windowEnd: now + 6 * 3600000 }) });
    const d = await r.json();
    setMsg(r.ok ? "Plan created (tentative). Others see it grayed out — a maybe, not a certainty." : d.error);
  };

  return (
    <div>
      <h1 className="mb-1 text-3xl">Plan ahead</h1>
      <p className="mb-5 text-sm" style={{ color: "rgba(232,200,180,0.55)" }}>
        Mark a coarse area you'll be in within 24h. It uses the same ~5-mile fuzzing — never a pin. You can back out of any meet for free; the only thing that costs you is claiming areas you're never actually near.
      </p>
      <button onClick={createPlan} className="w-full rounded-full py-3 text-sm font-medium" style={{ background: "linear-gradient(180deg,#ef9a63,#d6713f)", color: "#1a0e08" }}>
        Plan my current area for later today
      </button>
      {msg && <p className="mt-3 text-sm" style={{ color: "rgba(232,200,180,0.6)" }}>{msg}</p>}
    </div>
  );
}
