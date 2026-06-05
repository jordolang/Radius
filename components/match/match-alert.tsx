"use client";

/**
 * MatchAlert — the signature alert that a compatible, available person is in
 * your radius right now. Two embers (you + them) drift in from opposite edges,
 * meet at center, and ignite into expanding rings. Deliberately distinctive:
 * this is the app's "something is happening" moment, not a generic toast.
 *
 * It reveals NOTHING about the other person (the beacon alert is anonymous by
 * construction). Accepting opens the spark decision flow for the pair; the
 * profile only ever unlocks there, and only if interest becomes mutual.
 */

import { useState, type CSSProperties } from "react";

/** Per-ring stagger via a CSS custom property (typed loosely for the style attr). */
const ringDelay = (delay: string): CSSProperties => ({ ["--ring-delay"]: delay } as CSSProperties);

interface MatchAlertProps {
  onAccept: () => void;
  onDismiss: () => void;
}

export function MatchAlert({ onAccept, onDismiss }: MatchAlertProps) {
  const [leaving, setLeaving] = useState(false);

  const close = (after: () => void) => {
    setLeaving(true);
    window.setTimeout(after, 300);
  };

  return (
    <div
      className={`spark-overlay${leaving ? " is-leaving" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Someone compatible is nearby"
    >
      <div className="spark-stage" aria-hidden>
        <span className="spark-ring" style={ringDelay("1.15s")} />
        <span className="spark-ring" style={ringDelay("1.55s")} />
        <span className="spark-ember from-you" />
        <span className="spark-ember from-them" />
        <span className="spark-core" />
      </div>

      <div className="spark-rise max-w-xs text-center">
        <p className="eyebrow" style={{ color: "var(--ember)" }}>In your radius · now</p>
        <h2 className="mt-2 page-title">Someone caught a spark</h2>
        <p className="page-subtitle">
          A compatible person is available near you right this moment. No names, no
          location — just timing. Want to see if it&apos;s mutual?
        </p>

        <div className="mt-7 space-y-2">
          <button className="btn-primary w-full" onClick={() => close(onAccept)}>
            See if we&apos;re a match
          </button>
          <button className="btn-secondary w-full" onClick={() => close(onDismiss)}>
            Maybe later
          </button>
        </div>
        <p className="help-text mt-3">
          They&apos;re only revealed if you&apos;re both into it. Backing out is always free.
        </p>
      </div>
    </div>
  );
}
