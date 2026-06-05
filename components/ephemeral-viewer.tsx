"use client";

/**
 * EphemeralViewer — press-and-hold to reveal one-time media, then it's gone.
 *
 * IMPORTANT HONESTY (do not soften this in the UI):
 *  - On the WEB, screenshots cannot be blocked at all.
 *  - On native iOS, a screenshot can be DETECTED (notify the sender) but not
 *    blocked; a second phone photographing the screen defeats everything.
 *  - On native Android, FLAG_SECURE can block in-app screenshots/recording, but
 *    still not a second camera.
 * So the viewer DETERS (press-and-hold, no save/share UI, alias watermark,
 * screenshot detection where available) but never promises "uncapturable."
 * The sender is told this plainly before they send. Anything else would lull
 * someone into sharing intimate media they believe can't escape — which is the
 * exact harm we're trying to prevent.
 *
 * The watermark = the VIEWER's own alias + time, burned over the media. If they
 * screenshot, the capture identifies them. That's the strongest honest deterrent.
 */

import { useCallback, useRef, useState } from "react";

type Props = {
  mediaUrl: string; // short-lived signed URL; server deletes blob after view
  viewerAlias: string; // burned into the watermark
  onConsumed: () => void; // tell the server the view ended -> destroy
  onScreenshotDetected?: () => void; // wire to native screenshot event if present
};

export function EphemeralViewer({
  mediaUrl,
  viewerAlias,
  onConsumed,
  onScreenshotDetected,
}: Props) {
  const [revealed, setRevealed] = useState(false);
  const [spent, setSpent] = useState(false);
  const holdRef = useRef(false);

  const startHold = useCallback(() => {
    if (spent) return;
    holdRef.current = true;
    setRevealed(true);
  }, [spent]);

  const endHold = useCallback(() => {
    if (!holdRef.current) return;
    holdRef.current = false;
    setRevealed(false);
    setSpent(true);
    onConsumed(); // single view consumed; server destroys the blob
  }, [onConsumed]);

  const stamp = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className="mx-auto w-full max-w-sm select-none">
      <div
        className="relative aspect-[3/4] w-full overflow-hidden rounded-3xl border"
        style={{ borderColor: "var(--border-ember)", background: "var(--surface-2)" }}
        onMouseDown={startHold}
        onMouseUp={endHold}
        onMouseLeave={endHold}
        onTouchStart={(e) => {
          e.preventDefault();
          startHold();
        }}
        onTouchEnd={endHold}
        onContextMenu={(e) => e.preventDefault()} // block long-press save menu
      >
        {/* media only painted while held */}
        {revealed && !spent && (
          <>
            <img
              src={mediaUrl}
              alt=""
              draggable={false}
              className="h-full w-full object-cover"
              style={{ WebkitTouchCallout: "none", pointerEvents: "none" } as React.CSSProperties}
            />
            {/* tiled alias watermark — any screenshot incriminates the viewer */}
            <div
              className="pointer-events-none absolute inset-0 flex flex-wrap content-center justify-center gap-x-8 gap-y-10 opacity-30"
              style={{ transform: "rotate(-24deg) scale(1.4)" }}
              aria-hidden
            >
              {Array.from({ length: 16 }).map((_, i) => (
                <span key={i} className="text-xs font-semibold tracking-wider text-white">
                  {viewerAlias} · {stamp}
                </span>
              ))}
            </div>
          </>
        )}

        {/* idle / spent overlays */}
        {(!revealed || spent) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <div
              className="mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ background: "rgba(232,145,91,0.12)", border: "1px solid rgba(232,145,91,0.35)" }}
            >
              <span style={{ color: "var(--ember)" }}>{spent ? "✓" : "⊚"}</span>
            </div>
            <p className="text-sm" style={{ color: spent ? "var(--text-muted)" : "var(--fg-soft)" }}>
              {spent ? "Viewed once — now gone." : "Press and hold to view"}
            </p>
            {!spent && (
              <p className="mt-1 text-xs" style={{ color: "var(--text-faint)" }}>
                Disappears the moment you let go
              </p>
            )}
          </div>
        )}
      </div>

      {/* the honest line — shown to the SENDER at compose time too */}
      <p className="mt-3 text-center text-xs leading-relaxed" style={{ color: "var(--text-faint)" }}>
        We block saving and sharing in-app and watermark every view, but no app
        can stop a determined screenshot or a second camera. Only send what
        you're okay with existing.
      </p>
    </div>
  );
}
