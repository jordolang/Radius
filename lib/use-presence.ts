"use client";

/**
 * usePresence — client hook holding live availability + the device's location.
 *
 * PRIVACY: the raw {lat,lng} returned by geolocation lives ONLY in client state
 * here (to draw the map) and is quantized to a coarse ~5-mile cell before any
 * network call. Raw coordinates are never sent to or stored by the server — the
 * same contract enforced in lib/geo.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { toCoarseCell, type LatLng } from "@/lib/geo";

const POLL_MS = 20_000;
const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;

export interface PresenceState {
  coords: LatLng | null; // device location — on-device only, for the map
  locating: boolean;
  available: boolean;
  expiresAt: number | null;
  remaining: string;
  nearby: boolean;
  busy: boolean;
  error: string | null;
  goAvailable: () => Promise<void>;
  goUnavailable: () => Promise<void>;
}

export function usePresence(userId: string, ttlMs: number = DEFAULT_TTL_MS): PresenceState {
  const [coords, setCoords] = useState<LatLng | null>(null);
  const [locating, setLocating] = useState(true);
  const [available, setAvailable] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [remaining, setRemaining] = useState("");
  const [nearby, setNearby] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Continuously track the device location for the map (never leaves the device).
  useEffect(() => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLocating(false);
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
      },
      () => setLocating(false),
      { enableHighAccuracy: false, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const goAvailable = useCallback(async () => {
    if (!userId) return;
    setBusy(true);
    setError(null);
    try {
      let c = coords;
      if (!c) {
        const pos = await new Promise<GeolocationPosition>((res, rej) =>
          navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: false }),
        );
        c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
      }
      // ---- raw coords quantized here, once; only the coarse cell goes out ----
      const cell = toCoarseCell(c.lat, c.lng);
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
      setError(
        e instanceof GeolocationPositionError
          ? "Location permission is needed to find people nearby."
          : (e as Error).message,
      );
    } finally {
      setBusy(false);
    }
  }, [userId, coords, ttlMs]);

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

  // Poll the anonymous nearby indicator while available (boolean only).
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
        /* availability still valid */
      }
    };
    tick();
    pollRef.current = setInterval(tick, POLL_MS);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [available, userId]);

  // Auto-expiry countdown.
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

  return { coords, locating, available, expiresAt, remaining, nearby, busy, error, goAvailable, goUnavailable };
}
