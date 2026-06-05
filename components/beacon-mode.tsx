"use client";
import { useEffect, useState } from "react";

export function BeaconMode({ userId }: { userId: string }) {
  const [on, setOn] = useState(false);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    fetch("/api/beacon", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, mode: on ? "beacon" : "passive" }) });
  }, [on, userId]);

  useEffect(() => {
    if (!on) return;
    const tick = async () => {
      const r = await fetch(`/api/beacon?userId=${encodeURIComponent(userId)}`);
      const { alerts } = await r.json();
      setNearby(Array.isArray(alerts) && alerts.length > 0);
    };
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [on, userId]);

  return (
    <div className="card card-ember mt-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="section-title">Beacon mode</p>
          <p className="faint text-xs">
            Get pinged the moment someone available is near you.
          </p>
        </div>
        <button
          onClick={() => setOn((v) => !v)}
          className="h-7 w-12 rounded-full transition-colors"
          style={{ background: on ? "var(--ember)" : "rgba(255,255,255,0.15)" }}
          aria-pressed={on}
        >
          <span className="block h-6 w-6 rounded-full bg-white transition-transform"
            style={{ transform: on ? "translateX(22px)" : "translateX(2px)" }} />
        </button>
      </div>
      {on && nearby && (
        <p className="mt-3 text-sm" style={{ color: "var(--ember)" }}>● Someone nearby is available — open Discover.</p>
      )}
    </div>
  );
}
