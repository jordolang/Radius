"use client";
import dynamic from "next/dynamic";
import { BeaconMode } from "@/components/beacon-mode";
import { BeaconWatcher } from "@/components/match/beacon-watcher";
import { AuthGate } from "@/components/auth/auth-gate";
// Primary navigation now lives in the persistent bottom TabBar (see app/layout.tsx).

// The map touches `window`, so load it client-only (no SSR).
const RadiusMap = dynamic(() => import("@/components/radius-map").then((m) => m.RadiusMap), {
  ssr: false,
  loading: () => (
    <div
      className="flex items-center justify-center rounded-3xl border"
      style={{ borderColor: "var(--border-ember)", height: "62vh", minHeight: 420, background: "var(--surface-2)" }}
    >
      <span className="faint text-sm">Loading map…</span>
    </div>
  ),
});

export default function Home() {
  return (
    <AuthGate>
      {(uid) => (
        <div>
          <header className="mb-3 flex items-baseline justify-between">
            <h1 className="text-2xl" style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--fg)" }}>
              In The Mood
            </h1>
            <span className="eyebrow">Radius</span>
          </header>

          <RadiusMap userId={uid} />

          <BeaconMode userId={uid} />

          {/* Fires the signature spark alert when a compatible person is available nearby. */}
          <BeaconWatcher userId={uid} />
        </div>
      )}
    </AuthGate>
  );
}
