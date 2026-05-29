/**
 * premeet-signaling.ts — Protocol + state for the LIVE, UN-RECORDED pre-meet call.
 *
 * The call exists to (a) defeat catfishing — you see a live person, not an
 * avatar — and (b) walk both people through a safety checklist before meeting.
 *
 * NON-NEGOTIABLE: nothing here records. There is no MediaRecorder, no transcript,
 * no "consent clip", no media that survives the call. The peer media is P2P
 * (WebRTC); the server only relays signaling (SDP/ICE) and never sees frames.
 * The only artifact persisted is the ComplianceLog: booleans + timestamps.
 */

export type SignalMessage =
  | { t: "offer"; sdp: string; from: string }
  | { t: "answer"; sdp: string; from: string }
  | { t: "ice"; candidate: RTCIceCandidateInit; from: string }
  | { t: "checklist"; ack: ChecklistAck; from: string }
  | { t: "confirm"; from: string }
  | { t: "decline"; from: string }
  | { t: "bye"; from: string };

export interface ChecklistAck {
  publicPlaceAgreed: boolean;
  trustedContactShared: boolean;
  boundariesDiscussed: boolean;
}

export type CallPhase =
  | "connecting"
  | "live" // both media streams flowing
  | "ready_to_meet" // checklist done + both confirmed
  | "declined" // either side declined
  | "ended";

export interface CallState {
  phase: CallPhase;
  checklist: ChecklistAck;
  confirmed: Record<string, boolean>;
  startedAt?: number;
  endedAt?: number;
}

export function initCall(a: string, b: string): CallState {
  return {
    phase: "connecting",
    checklist: { publicPlaceAgreed: false, trustedContactShared: false, boundariesDiscussed: false },
    confirmed: { [a]: false, [b]: false },
  };
}

function checklistComplete(c: ChecklistAck): boolean {
  return c.publicPlaceAgreed && c.trustedContactShared && c.boundariesDiscussed;
}

function bothConfirmed(c: Record<string, boolean>): boolean {
  const vals = Object.values(c);
  return vals.length === 2 && vals.every(Boolean);
}

/** Pure reducer: advance call state from a signaling event. */
export function reduceCall(state: CallState, msg: SignalMessage, now = Date.now()): CallState {
  switch (msg.t) {
    case "answer":
    case "offer":
      return state.phase === "connecting"
        ? { ...state, phase: "live", startedAt: state.startedAt ?? now }
        : state;
    case "checklist":
      return { ...state, checklist: msg.ack };
    case "confirm": {
      const confirmed = { ...state.confirmed, [msg.from]: true };
      const ready = checklistComplete(state.checklist) && bothConfirmed(confirmed);
      return { ...state, confirmed, phase: ready ? "ready_to_meet" : state.phase };
    }
    case "decline":
      return { ...state, phase: "declined", endedAt: now };
    case "bye":
      return { ...state, phase: state.phase === "ready_to_meet" ? "ready_to_meet" : "ended", endedAt: now };
    case "ice":
      return state;
  }
}

/** Can this user tap "confirm we'll meet" yet? Only once the checklist is done. */
export function canConfirm(state: CallState): boolean {
  return state.phase === "live" && checklistComplete(state.checklist);
}
