/**
 * ephemeral.ts — One-time, self-destructing media (Snapchat-style).
 *
 * Lifecycle of a shared item:
 *   created -> available -> viewing -> destroyed
 *                       \-> expired (TTL passed, never viewed)
 *
 * Guarantees we CAN make (server-side, real):
 *   - An item is viewable at most `maxViews` times (default 1), then destroyed.
 *   - The server stores only an encrypted blob + minimal metadata. No preview,
 *     no thumbnail, no copy retained after viewing/expiry.
 *   - Sharing explicit media requires BOTH mutual content-sharing consent AND
 *     BOTH users age-verified. This gate is non-negotiable.
 *
 * Guarantees we CANNOT make (see ephemeral-viewer.tsx for the honest UX):
 *   - We cannot truly prevent a screenshot or a second-camera photo. The viewer
 *     deters and (on some platforms) detects, but the SENDER must understand the
 *     recipient could capture. The UI must say so plainly.
 */

export type MediaState = "available" | "viewing" | "destroyed" | "expired";

export interface EphemeralItem {
  id: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  state: MediaState;
  maxViews: number;
  viewsUsed: number;
  expiresAt: number; // TTL if never opened
  createdAt: number;
  // NOTE: the encrypted blob lives in object storage keyed by id; it is DELETED
  // when state becomes "destroyed" or "expired". No field here ever holds pixels.
}

export interface ShareGate {
  bothContentConsent: boolean; // from match.canShareRealMedia
  senderAgeVerified: boolean;
  recipientAgeVerified: boolean;
}

export function canCreateShare(gate: ShareGate): { ok: boolean; reason?: string } {
  if (!gate.bothContentConsent)
    return { ok: false, reason: "both users must consent to share real media first" };
  if (!gate.senderAgeVerified || !gate.recipientAgeVerified)
    return { ok: false, reason: "both users must be age-verified to share intimate media" };
  return { ok: true };
}

export function createItem(params: {
  id: string;
  matchId: string;
  senderId: string;
  recipientId: string;
  ttlMs?: number;
  maxViews?: number;
}): EphemeralItem {
  const now = Date.now();
  return {
    id: params.id,
    matchId: params.matchId,
    senderId: params.senderId,
    recipientId: params.recipientId,
    state: "available",
    maxViews: params.maxViews ?? 1,
    viewsUsed: 0,
    expiresAt: now + (params.ttlMs ?? 24 * 60 * 60 * 1000),
    createdAt: now,
  };
}

/** Expire-on-read check; call before any access. */
export function refresh(item: EphemeralItem, now = Date.now()): EphemeralItem {
  if (item.state === "available" && now >= item.expiresAt) {
    return { ...item, state: "expired" }; // signal storage layer to delete blob
  }
  return item;
}

/** Recipient presses and holds -> begin a view. Only the recipient may view. */
export function beginView(
  item: EphemeralItem,
  viewerId: string,
  now = Date.now(),
): { item: EphemeralItem; granted: boolean; reason?: string } {
  const fresh = refresh(item, now);
  if (fresh.state !== "available")
    return { item: fresh, granted: false, reason: `not viewable (${fresh.state})` };
  if (viewerId !== fresh.recipientId)
    return { item: fresh, granted: false, reason: "only the recipient may view" };
  return { item: { ...fresh, state: "viewing" }, granted: true };
}

/** Finger released, or view-window elapsed -> consume a view; destroy if spent. */
export function endView(item: EphemeralItem): EphemeralItem {
  if (item.state !== "viewing") return item;
  const viewsUsed = item.viewsUsed + 1;
  const state: MediaState = viewsUsed >= item.maxViews ? "destroyed" : "available";
  return { ...item, viewsUsed, state }; // "destroyed" => storage deletes the blob
}

export function isGone(item: EphemeralItem): boolean {
  return item.state === "destroyed" || item.state === "expired";
}
