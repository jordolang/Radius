"use client";

/**
 * SparkDecision — the matching interface from alert to reveal.
 *
 * Faithful to the reveal ladder in lib/match.ts:
 *   1. DECIDING  — stage "candidate", you haven't opted in. Nothing about the
 *      other person is shown (the server returns otherProfile: null here). You
 *      answer the attraction inquiry: into it, or not. This is curiosity/intent
 *      by design — the reveal is the reward for a MUTUAL yes.
 *   2. WAITING   — you're in; they haven't tapped back yet. We poll quietly.
 *   3. REVEALED  — both opted in -> stage flips to mutual_interest, the avatar +
 *      profile unlock, and they bloom into view. A final, honest "still feeling
 *      it?" lets you continue to chat or pass quietly (backing out is free).
 *
 * The component never reveals a profile the server hasn't unlocked.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { Profile } from "@/lib/profile";

type PublicProfile = Omit<Profile, "userId" | "health">;

interface Teaser {
  avatarUrl: string;
  age: number;
  heightBand: string;
  bodyType: string;
}

interface MatchView {
  stage: string;
  youInterested: boolean;
  canChat: boolean;
  teaser: Teaser | null;
  otherProfile: PublicProfile | null;
}

type Phase = "loading" | "deciding" | "waiting" | "revealed" | "closed";

interface SparkDecisionProps {
  matchId: string; // "a__b"
  selfId: string;
  onProceed: () => void; // continue into chat / pre-meet (parent owns that surface)
}

const WAIT_POLL_MS = 4_000;

export function SparkDecision({ matchId, selfId, onProceed }: SparkDecisionProps) {
  const [a, b] = matchId.split("__");
  const [view, setView] = useState<MatchView | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const revealStartedRef = useRef(false);

  const read = useCallback(async (): Promise<MatchView | null> => {
    try {
      const r = await fetch(
        `/api/match?a=${encodeURIComponent(a)}&b=${encodeURIComponent(b)}&userId=${encodeURIComponent(selfId)}`,
      );
      const d = await r.json();
      if (!r.ok) throw new Error(d.error ?? "could not load match");
      return d as MatchView;
    } catch (e) {
      setError(e instanceof Error ? e.message : "could not load match");
      return null;
    }
  }, [a, b, selfId]);

  const act = useCallback(
    async (action: "interest" | "decline"): Promise<MatchView | null> => {
      setBusy(true);
      setError(null);
      try {
        const r = await fetch("/api/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, a, b, userId: selfId }),
        });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error ?? "something went wrong");
        setView(d as MatchView);
        return d as MatchView;
      } catch (e) {
        setError(e instanceof Error ? e.message : "something went wrong");
        return null;
      } finally {
        setBusy(false);
      }
    },
    [a, b, selfId],
  );

  // Initial read (read-only — does NOT opt you in).
  useEffect(() => {
    if (!selfId) return;
    read().then((v) => v && setView(v));
  }, [selfId, read]);

  const phase: Phase = !view
    ? "loading"
    : view.stage === "closed"
      ? "closed"
      : view.stage !== "candidate"
        ? "revealed"
        : view.youInterested
          ? "waiting"
          : "deciding";

  // While waiting for the other side, poll until it goes mutual (or closes).
  useEffect(() => {
    if (phase !== "waiting") return;
    const id = setInterval(async () => {
      const v = await read();
      if (v) setView(v);
    }, WAIT_POLL_MS);
    return () => clearInterval(id);
  }, [phase, read]);

  if (phase === "revealed") revealStartedRef.current = true;

  if (phase === "loading") {
    return <div className="card"><p className="faint text-sm">Finding the spark…</p></div>;
  }

  if (phase === "closed") {
    return (
      <div className="card text-center">
        <p className="section-title">This one&apos;s closed</p>
        <p className="faint mt-1 text-sm">No hard feelings — the radius is always refreshing.</p>
      </div>
    );
  }

  if (phase === "deciding") {
    const t = view!.teaser;
    return (
      <div className="card card-ember text-center">
        <div className="reveal-avatar">
          {t?.avatarUrl ? (
            // Masked, de-identified avatar — the pre-match photo. Real face unlocks at mutual interest.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={t.avatarUrl} alt="Their masked avatar" />
          ) : (
            <span className="reveal-masked">◆</span>
          )}
        </div>

        {t && (
          <div className="mt-4 flex flex-wrap justify-center gap-1.5">
            <span className="chip chip-on text-xs">{t.age}</span>
            <span className="chip chip-on text-xs">{t.heightBand}</span>
            <span className="chip chip-on text-xs">{cap(t.bodyType)}</span>
          </div>
        )}

        <p className="eyebrow mt-3" style={{ color: "var(--ember)" }}>Available · in your radius</p>
        <h2 className="mt-1 page-title">Attracted?</h2>
        <p className="page-subtitle mx-auto max-w-xs">
          They&apos;re within both your absolutes and open right now. Their face is masked
          until you&apos;re both in — go with your gut.
        </p>

        <div className="mt-6 flex gap-2">
          <button className="btn-secondary flex-1" disabled={busy} onClick={() => act("decline")}>
            Pass
          </button>
          <button className="btn-primary flex-1" disabled={busy} onClick={() => act("interest")}>
            I&apos;m into it
          </button>
        </div>
        {error && <p className="error-text mt-3">{error}</p>}
      </div>
    );
  }

  if (phase === "waiting") {
    return (
      <div className="card card-ember text-center">
        <div className="reveal-avatar" aria-hidden>
          <span className="reveal-masked" style={{ animation: "radius-pulse 2.4s ease-out infinite" }}>◆</span>
        </div>
        <h2 className="mt-4 page-title">You&apos;re in</h2>
        <p className="page-subtitle mx-auto max-w-xs">
          We&apos;ll spark the moment they tap back. You can keep moving — we&apos;ll alert you if it goes mutual.
        </p>
        <button className="btn-secondary mt-6 w-full" disabled={busy} onClick={() => act("decline")}>
          Change my mind
        </button>
        {error && <p className="error-text mt-3">{error}</p>}
      </div>
    );
  }

  // phase === "revealed"
  const p = view!.otherProfile;
  return (
    <div className="card card-ember text-center">
      <p className="eyebrow" style={{ color: "var(--ember)" }}>It&apos;s mutual</p>
      <h2 className="mb-4 mt-1 page-title">You both sparked</h2>

      <div className={`reveal-avatar${revealStartedRef.current ? " is-revealing" : ""}`}>
        {p?.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.avatarUrl} alt="Their stylized avatar" />
        ) : (
          <span className="reveal-masked">◆</span>
        )}
      </div>

      <h3 className="mt-4 text-2xl" style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--fg)" }}>
        {p?.alias ?? "Someone"}
      </h3>

      {p ? (
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {descriptorsOf(p).map((d) => (
            <span key={d} className="chip chip-on text-xs">{d}</span>
          ))}
        </div>
      ) : (
        <p className="faint mt-2 text-sm">They haven&apos;t filled out their profile yet.</p>
      )}

      {p?.bio && <p className="muted mx-auto mt-3 max-w-xs text-sm leading-relaxed">{p.bio}</p>}

      <p className="page-subtitle mx-auto mt-4 max-w-xs">
        This is them. Still feeling it? Saying hello opens a private chat — real photos
        only ever flow later, and only if you both agree.
      </p>

      <div className="mt-6 flex gap-2">
        <button className="btn-secondary flex-1" disabled={busy} onClick={() => act("decline")}>
          Pass quietly
        </button>
        <button className="btn-primary flex-1" onClick={onProceed}>
          Say hello
        </button>
      </div>
      {error && <p className="error-text mt-3">{error}</p>}
    </div>
  );
}

/** A small, tasteful set of coarse descriptors for the reveal — never a data dump. */
function descriptorsOf(p: PublicProfile): string[] {
  const relationship: Record<string, string> = {
    single: "Single",
    open_relationship: "Open relationship",
    polyamorous: "Polyamorous",
    separated: "Separated",
  };
  return [
    cap(p.gender),
    p.heightBand,
    cap(p.bodyType),
    `${cap(p.hairColor)} hair`,
    relationship[p.relationshipStatus] ?? cap(p.relationshipStatus),
  ].filter(Boolean);
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
