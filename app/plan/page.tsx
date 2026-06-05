"use client";
import { useState } from "react";
import { PageHeader, PrimaryButton } from "@/components/ui";
import { AuthGate } from "@/components/auth/auth-gate";
import { toCoarseCell } from "@/lib/geo";

function PlanAhead() {
  const [msg, setMsg] = useState<string | null>(null);

  const createPlan = async () => {
    setMsg(null);
    const pos = await new Promise<GeolocationPosition>((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false }));
    const cell = toCoarseCell(pos.coords.latitude, pos.coords.longitude); // coarsened on-device
    const now = Date.now();
    const r = await fetch("/api/plan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cell, windowStart: now + 2 * 3600000, windowEnd: now + 6 * 3600000 }),
    });
    const d = await r.json();
    setMsg(r.ok ? "Plan created (tentative). Others see it grayed out — a maybe, not a certainty." : d.error);
  };

  return (
    <div>
      <PageHeader title="Plan ahead">
        Mark a coarse area you&apos;ll be in within 24h. It uses the same ~5-mile fuzzing — never a pin. You can back out of any meet for free; the only thing that costs you is claiming areas you&apos;re never actually near.
      </PageHeader>
      <PrimaryButton block onClick={createPlan}>
        Plan my current area for later today
      </PrimaryButton>
      {msg && <p className="muted mt-3 text-sm">{msg}</p>}
    </div>
  );
}

export default function Plan() {
  return <AuthGate>{() => <PlanAhead />}</AuthGate>;
}
