"use client";

/**
 * PhotoGallery — the five-photo control on the profile page.
 *
 * Slot 0 is the MAIN photo: it is the only photo shown on the map, and it is
 * turned into a cartoonized, de-identified avatar (see lib/avatarize.ts) the
 * moment it finishes uploading. Slots 1–4 are OPTIONAL real photos that stay
 * blurred to everyone until a match is made and both people agree to proceed —
 * then they reveal in focus, no blur. Here on your own editor they're shown with
 * a soft "locked" treatment so you understand exactly what others can/can't see.
 */

import { useRef, useState } from "react";
import { MAX_REVEAL_PHOTOS } from "@/lib/profile";

interface PhotoGalleryProps {
  avatarUrl: string | null;
  revealPhotos: string[];
  onAvatarFile: (file: File) => void | Promise<void>;
  onRevealFile: (file: File) => void | Promise<void>;
  onRemoveReveal: (index: number) => void;
  avatarBusy?: boolean;
}

function fileFrom(e: React.ChangeEvent<HTMLInputElement>): File | null {
  return e.target.files?.[0] ?? null;
}

export function PhotoGallery({
  avatarUrl, revealPhotos, onAvatarFile, onRevealFile, onRemoveReveal, avatarBusy,
}: PhotoGalleryProps) {
  const mainInput = useRef<HTMLInputElement>(null);
  const addInput = useRef<HTMLInputElement>(null);
  const [showReal, setShowReal] = useState(false);
  const canAddMore = revealPhotos.length < MAX_REVEAL_PHOTOS;

  return (
    <div className="space-y-3">
      {/* Main photo — the cartoon shown on the map */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => mainInput.current?.click()}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border"
          style={{ borderColor: "var(--border-ember)", background: "var(--surface-2)" }}
          aria-label="Upload main photo"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="Your cartoonized map avatar" className="h-full w-full object-cover" />
          ) : (
            <span className="faint text-center text-[11px] leading-tight px-1">Add main<br />photo</span>
          )}
          {avatarBusy && (
            <span className="absolute inset-0 flex items-center justify-center text-xs" style={{ background: "rgba(14,11,10,0.7)", color: "var(--ember)" }}>
              Cartoonizing…
            </span>
          )}
        </button>
        <div className="min-w-0">
          <p className="section-title">Main photo</p>
          <p className="help-text mt-1">
            The only photo shown on the map — and only as a cartoon. We strip
            location data and stylize it the moment you upload, so it hints at
            your look without identifying you.
          </p>
          <input ref={mainInput} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = fileFrom(e); if (f) onAvatarFile(f); e.target.value = ""; }} />
        </div>
      </div>

      {/* Optional reveal photos */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="section-title">Private photos ({revealPhotos.length}/{MAX_REVEAL_PHOTOS})</p>
          {revealPhotos.length > 0 && (
            <button type="button" className="link-ember text-xs" onClick={() => setShowReal((s) => !s)}>
              {showReal ? "Preview blurred" : "Show me"}
            </button>
          )}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: MAX_REVEAL_PHOTOS }).map((_, i) => {
            const src = revealPhotos[i];
            if (src) {
              return (
                <div key={i} className="relative aspect-square overflow-hidden rounded-xl border" style={{ borderColor: "var(--border)" }}>
                  <img
                    src={src}
                    alt={`Private photo ${i + 1}`}
                    className="h-full w-full object-cover transition-all"
                    style={{ filter: showReal ? "none" : "blur(8px) saturate(0.85)" }}
                  />
                  {!showReal && (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-lg" style={{ color: "var(--fg-soft)", textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
                      🔒
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveReveal(i)}
                    className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full text-[11px]"
                    style={{ background: "rgba(14,11,10,0.85)", color: "var(--fg-soft)" }}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    ✕
                  </button>
                </div>
              );
            }
            const isNextSlot = i === revealPhotos.length;
            return (
              <button
                key={i}
                type="button"
                disabled={!isNextSlot || !canAddMore}
                onClick={() => addInput.current?.click()}
                className="flex aspect-square items-center justify-center rounded-xl border text-xl disabled:opacity-40"
                style={{ borderColor: "var(--border)", color: "var(--text-faint)", background: "var(--surface-2)" }}
                aria-label="Add a private photo"
              >
                +
              </button>
            );
          })}
        </div>
        <p className="help-text mt-2">
          Optional. These stay blurred to everyone until you match and both agree
          to go further — then they reveal in focus.
        </p>
        <input ref={addInput} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = fileFrom(e); if (f) onRevealFile(f); e.target.value = ""; }} />
      </div>
    </div>
  );
}
