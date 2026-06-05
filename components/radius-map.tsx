"use client";

/**
 * RadiusMap — the home screen's hero: a live dark map centered on YOU.
 *
 * What it shows (and deliberately does NOT show):
 *  - Your device location as a pulsing dot (on-device only, never transmitted).
 *  - Your exact coarse ~5-mile cell = "the only area anyone else can infer".
 *  - A faint proximity-reach ring so you understand how far a match can be.
 *  - An ambient halo on your own dot when /api/alert says someone is also
 *    available nearby — an anonymous boolean, never a position, count, or person.
 *    No other user is ever plotted on this map.
 *
 * Rendering engine:
 *  - Mapbox GL JS when NEXT_PUBLIC_MAPBOX_TOKEN is set (rich vector dark map).
 *  - Leaflet + Carto dark tiles otherwise, so the app still runs token-free.
 * Both engines honor the identical privacy contract above.
 */

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { usePresence } from "@/lib/use-presence";
import type { MapCanvasProps } from "@/components/map/mapbox-canvas";
import type { ComponentType } from "react";

const hasMapboxToken = Boolean(process.env.NEXT_PUBLIC_MAPBOX_TOKEN);

const MapboxCanvas = dynamic<MapCanvasProps>(
  () => import("@/components/map/mapbox-canvas").then((m) => m.MapboxCanvas),
  { ssr: false },
);
const LeafletCanvas = dynamic<MapCanvasProps>(
  () => import("@/components/map/leaflet-canvas").then((m) => m.LeafletCanvas),
  { ssr: false },
);

export function RadiusMap({ userId }: { userId: string }) {
  const { coords, locating, available, remaining, nearby, busy, error, goAvailable, goUnavailable } =
    usePresence(userId);

  const Canvas = useMemo<ComponentType<MapCanvasProps>>(
    () => (hasMapboxToken ? MapboxCanvas : LeafletCanvas),
    [],
  );

  return (
    <div className="relative overflow-hidden rounded-3xl border" style={{ borderColor: "var(--border-ember)", height: "62vh", minHeight: 420 }}>
      <Canvas coords={coords} available={available} nearby={nearby} />

      {/* top status eyebrow */}
      <div className="pointer-events-none absolute left-4 top-4 z-[500] flex items-center gap-2">
        <span className="eyebrow" style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
          {locating && !coords ? "Locating…" : available ? "You're on the map" : "You're hidden"}
        </span>
      </div>

      {/* bottom control panel */}
      <div className="absolute inset-x-0 bottom-0 z-[500] p-3">
        <div
          className="rounded-2xl border p-4"
          style={{ borderColor: "var(--border)", background: "rgba(16,11,10,0.82)", backdropFilter: "blur(8px)" }}
        >
          <h2 className="text-2xl leading-tight" style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--fg)" }}>
            {available ? "Open to meeting, nearby." : "In the mood?"}
          </h2>
          <p className="muted mt-1 text-xs leading-relaxed">
            {available
              ? "Others only see the glowing ~5-mile cell — never your exact spot."
              : "Flip on to drop onto the map. We share a ~5-mile cell, never your pin or real photo."}
          </p>

          {available && (
            <div
              className="mt-3 flex items-center gap-2.5 rounded-xl border px-3 py-2"
              style={{
                borderColor: nearby ? "var(--ember-line)" : "var(--border-soft)",
                background: nearby ? "var(--ember-tint)" : "rgba(255,255,255,0.03)",
              }}
            >
              <span className="relative flex h-2.5 w-2.5" aria-hidden>
                {nearby && <span className="absolute inline-flex h-full w-full animate-ping rounded-full" style={{ background: "var(--ember)" }} />}
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full" style={{ background: nearby ? "var(--ember)" : "rgba(255,255,255,0.25)" }} />
              </span>
              <span className="text-sm" style={{ color: "var(--fg-soft)" }}>
                {nearby ? "Someone nearby is also available" : "No one nearby right now"}
              </span>
            </div>
          )}

          <button
            onClick={available ? goUnavailable : goAvailable}
            disabled={busy}
            className={`mt-3 w-full ${available ? "btn-secondary" : "btn-primary"}`}
          >
            {busy ? "One sec…" : available ? "Go hidden" : "I'm available now"}
          </button>

          <div className="faint mt-2 flex items-center justify-between text-xs">
            <span>{available && remaining ? remaining : "Auto-expires when on"}</span>
            <span>Mutual opt-in to connect</span>
          </div>

          {error && <p className="error-text mt-2">{error}</p>}
        </div>
      </div>
    </div>
  );
}
