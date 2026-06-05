"use client";

/**
 * useBeaconAlerts — watches /api/beacon for the anonymous "someone compatible is
 * available nearby" nudge and surfaces ONE pending alert at a time for the
 * MatchAlert overlay.
 *
 * The alert carries only a `matchId` (a sorted user-pair id) — no name, avatar,
 * count, or location, exactly as lib/beacon guarantees. Dismissed matches are
 * remembered for the session so the overlay never nags about the same pair.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export interface PendingAlert {
  matchId: string;
}

const POLL_MS = 12_000;

export function useBeaconAlerts(userId: string, enabled: boolean) {
  const [alert, setAlert] = useState<PendingAlert | null>(null);
  const handledRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || !userId) return;
    let cancelled = false;

    const tick = async () => {
      try {
        const r = await fetch(`/api/beacon?userId=${encodeURIComponent(userId)}`);
        const data = await r.json();
        if (cancelled || !Array.isArray(data.alerts)) return;
        const fresh = data.alerts.find(
          (a: { matchId: string }) => a.matchId && !handledRef.current.has(a.matchId),
        );
        // Only raise a new alert if nothing is already on screen.
        if (fresh) setAlert((cur) => cur ?? { matchId: fresh.matchId });
      } catch {
        /* transient; next tick retries */
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId, enabled]);

  const dismiss = useCallback(() => {
    setAlert((cur) => {
      if (cur) handledRef.current.add(cur.matchId);
      return null;
    });
  }, []);

  return { alert, dismiss };
}
