"use client";

/**
 * AvailabilityToggle — the core interaction.
 *
 * Privacy-by-construction on the client:
 *  - Geolocation is read on-device and IMMEDIATELY quantized to a coarse cell
 *    via toCoarseCell(). The raw {lat,lng} is used for exactly one synchronous
 *    line and never stored in state, never sent over the network.
 *  - The server only ever receives the coarse cell string.
 *  - The "someone nearby" indicator is intentionally anonymous: no names, no
 *    faces, no count — just presence.
 *
 * Styling: refined dark + ember. Drop-in Tailwind; swap primitives for
 * shadcn/ui <Switch>, <Card> etc. if desired. Pair a display serif (e.g.
 * Fraunces) with a clean body via next/font for the intended feel.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toCoarseCell } from "@/lib/geo";

type Props = { userId: string; ttlMs?: number };

const POLL_MS = 20_000;

export function AvailabilityToggle({ userId, ttlMs = 2 * 60 * 60 * 1000 }: Props) {
  const [available, setAvailable] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");
  const [nearby, setNearby] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goAvailable = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const pos = await new Promise<GeolocationPosition>((res, rej) =>
        navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false }),
      );
      // ---- the only place raw coords exist; quantized on the next line ----
      const cell = toCoarseCell(pos.coords.latitude, pos.coords.longitude);
      // (raw coords now go out of scope; only `cell` continues)
      const r = await fetch("/api/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, cell, ttlMs }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "could not go available");
      setAvailable(true);
      setExpiresAt(data.expiresAt);
    } catch (e) {
      setError(e instanceof GeolocationPositionError ? "Location permission is needed to find people nearby." : (e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [userId, ttlMs]);

  const goUnavailable = useCallback(async () => {
    setBusy(true);
    try {
      await fetch("/api/presence", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
    } finally {
      setAvailable(false);
      setExpiresAt(null);
      setNearby(false);
      setBusy(false);
    }
  }, [userId]);

  // poll the anonymous nearby indicator while available
  useEffect(() => {
    if (!available) {
      if (pollRef.current) clearInterval(pollRef.current);
      return;
    }
    const tick = async () => {
      try {
        const r = await fetch(`/api/alert?userId=${encodeURIComponent(userId)}`);
        const data = await r.json();
        setNearby(Boolean(data.someoneNearbyAvailable));
      } catch {
        /* silent: availability still valid */
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [available, userId]);

  // auto-expiry countdown
  useEffect(() => {
    if (!expiresAt) return;
    const id = setInterval(() => {
      const ms = expiresAt - Date.now();
      if (ms <= 0) {
        setAvailable(false);
        setExpiresAt(null);
        setNearby(false);
        setRemaining("");
        clearInterval(id);
        return;
      }
      const m = Math.floor(ms / 60000);
      const h = Math.floor(m / 60);
      setRemaining(h > 0 ? `${h}h ${m % 60}m left` : `${m}m left`);
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  return (
    <div className="mx-auto w-full max-w-sm">
      <div
        className="relative overflow-hidden rounded-3xl border p-7"
        style={{
          background:
            "radial-gradient(120% 80% at 50% 0%, #2a1410 0%, #15100e 55%, #0e0b0a 100%)",
          borderColor: "rgba(214,122,72,0.22)",
          boxShadow: "0 30px 80px -40px rgba(214,122,72,0.5)",
        }}
      >
        {/* status eyebrow */}
        <div className="flex items-center justify-between">
          <span
            className="text-[11px] uppercase tracking-[0.28em]"
            style={{ color: "rgba(232,200,180,0.55)" }}
          >
            {available ? "You're available" : "You're hidden"}
          </span>
          <span
            className="h-2.5 w-2.5 rounded-full transition-all"
            style={{
              background: available ? "#e8915b" : "rgba(255,255,255,0.18)",
              boxShadow: available ? "0 0 14px 3px rgba(232,145,91,0.7)" : "none",
            }}
          />
        </div>

        {/* headline */}
        <h2
          className="mt-5 text-3xl leading-tight"
          style={{ fontFamily: "var(--font-display, ui-serif, Georgia, serif)", color: "#f6ece4" }}
        >
          {available ? "Open to meeting\nsomeone, nearby." : "In the mood?"}
        </h2>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: "rgba(232,200,180,0.6)" }}>
          {available
            ? "Only your rough area is shared, and only while this is on. Turn it off anytime — it also expires on its own."
            : "Flip this on when you want to be found. We share a ~5-mile area, never your exact location, and never your real photo."}
        </p>

        {/* anonymous nearby indicator */}
        {available && (
          <div
            className="mt-5 flex items-center gap-3 rounded-2xl border px-4 py-3"
            style={{
              borderColor: nearby ? "rgba(232,145,91,0.4)" : "rgba(255,255,255,0.08)",
              background: nearby ? "rgba(232,145,91,0.08)" : "rgba(255,255,255,0.03)",
            }}
          >
            <span
              className="relative flex h-2.5 w-2.5"
              aria-hidden
            >
              {nearby && (
                <span
                  className="absolute inline-flex h-full w-full animate-ping rounded-full"
                  style={{ background: "rgba(232,145,91,0.7)" }}
                />
              )}
              <span
                className="relative inline-flex h-2.5 w-2.5 rounded-full"
                style={{ background: nearby ? "#e8915b" : "rgba(255,255,255,0.25)" }}
              />
            </span>
            <span className="text-sm" style={{ color: "#f0ddd0" }}>
              {nearby ? "Someone nearby is also available" : "No one nearby right now"}
            </span>
          </div>
        )}

        {/* primary action */}
        <button
          onClick={available ? goUnavailable : goAvailable}
          disabled={busy}
          className="mt-6 w-full rounded-full py-3.5 text-sm font-medium tracking-wide transition-transform active:scale-[0.98] disabled:opacity-50"
          style={{
            background: available ? "rgba(255,255,255,0.06)" : "linear-gradient(180deg,#ef9a63,#d6713f)",
            color: available ? "#f0ddd0" : "#1a0e08",
            border: available ? "1px solid rgba(255,255,255,0.12)" : "none",
          }}
        >
          {busy ? "One sec…" : available ? "Go hidden" : "I'm available now"}
        </button>

        {/* meta row */}
        <div className="mt-3 flex items-center justify-between text-xs" style={{ color: "rgba(232,200,180,0.45)" }}>
          <span>{available && remaining ? remaining : "Auto-expires when on"}</span>
          <span>Mutual opt-in required to connect</span>
        </div>

        {error && (
          <p className="mt-3 text-xs" style={{ color: "#f2a08a" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
