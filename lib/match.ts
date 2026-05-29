/**
 * match.ts — Mutual-consent gate and match progression.
 *
 * Reveal ladder (each rung needs BOTH users):
 *   candidate         -> both available & nearby; nothing revealed
 *   mutual_interest   -> both tapped "interested"; avatar + chat unlock
 *   premeet_required  -> live (un-recorded) call must occur before meeting
 *   ready_to_meet     -> both confirmed after the call
 *
 * Anything that reveals identity-ish info (avatar, chat) is gated behind a
 * BOTH-true check. A single user can never pull info about another unilaterally.
 */

import type { Match, MatchStage, PreMeetCall, UserId } from "./types";

export function createCandidate(a: UserId, b: UserId): Match {
  const now = Date.now();
  const [x, y] = [a, b].sort(); // stable ordering so (a,b) and (b,a) are one match
  return {
    id: `${x}__${y}`,
    a: x,
    b: y,
    stage: "candidate",
    interested: { [x]: false, [y]: false },
    contentSharingConsent: { [x]: false, [y]: false },
    createdAt: now,
    updatedAt: now,
  };
}

function bothTrue(rec: Record<UserId, boolean>): boolean {
  return Object.values(rec).every(Boolean);
}

/** Record a user tapping "interested". Reveal happens only when both have. */
export function expressInterest(match: Match, userId: UserId): Match {
  if (!(userId in match.interested)) throw new Error("user not in match");
  const interested = { ...match.interested, [userId]: true };
  let stage: MatchStage = match.stage;
  if (match.stage === "candidate" && bothTrue(interested)) {
    stage = "mutual_interest";
  }
  return { ...match, interested, stage, updatedAt: Date.now() };
}

/** Either user can decline at any point; closes cleanly, no reason owed. */
export function decline(match: Match): Match {
  return { ...match, stage: "closed", updatedAt: Date.now() };
}

/** Is the avatar/profile visible to this pair yet? Only at mutual interest+. */
export function canSeeAvatar(match: Match): boolean {
  return (
    match.stage === "mutual_interest" ||
    match.stage === "premeet_required" ||
    match.stage === "ready_to_meet"
  );
}

/** Is chat open? Same gate as avatar. */
export function canChat(match: Match): boolean {
  return canSeeAvatar(match);
}

/**
 * Real photos/video are NOT part of the profile. They can only flow in chat
 * after BOTH users opt into content sharing, and consent is revocable.
 */
export function setContentSharingConsent(
  match: Match,
  userId: UserId,
  allow: boolean,
): Match {
  if (!canChat(match)) throw new Error("chat not open");
  return {
    ...match,
    contentSharingConsent: { ...match.contentSharingConsent, [userId]: allow },
    updatedAt: Date.now(),
  };
}

export function canShareRealMedia(match: Match): boolean {
  return canChat(match) && bothTrue(match.contentSharingConsent);
}

/** Move toward meeting: require the live pre-meet call first. */
export function requirePreMeet(match: Match): Match {
  if (match.stage !== "mutual_interest") return match;
  return { ...match, stage: "premeet_required", updatedAt: Date.now() };
}

export function newPreMeetCall(matchId: string, users: [UserId, UserId]): PreMeetCall {
  return {
    matchId,
    status: "required",
    checklistAck: {
      publicPlaceAgreed: false,
      trustedContactShared: false,
      boundariesDiscussed: false,
    },
    confirmedProceed: { [users[0]]: false, [users[1]]: false },
  };
}

/**
 * Complete the live call. We assert the safety checklist was acknowledged and
 * both confirmed — and we store ONLY those booleans/timestamps, never content.
 */
export function completePreMeet(
  match: Match,
  call: PreMeetCall,
): { match: Match; call: PreMeetCall } {
  const checklistDone =
    call.checklistAck.publicPlaceAgreed &&
    call.checklistAck.trustedContactShared &&
    call.checklistAck.boundariesDiscussed;
  const bothConfirmed = Object.values(call.confirmedProceed).every(Boolean);

  const completedCall: PreMeetCall = {
    ...call,
    status: checklistDone && bothConfirmed ? "completed" : call.status,
    endedAt: Date.now(),
  };

  const nextMatch: Match =
    completedCall.status === "completed"
      ? { ...match, stage: "ready_to_meet", updatedAt: Date.now() }
      : match;

  return { match: nextMatch, call: completedCall };
}
