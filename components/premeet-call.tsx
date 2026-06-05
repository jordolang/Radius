"use client";

/**
 * PreMeetCall — the live, UN-RECORDED pre-meet video call.
 *
 * Purpose: see a real, live person (defeats catfishing) and walk a safety
 * checklist together before agreeing to meet. Media is peer-to-peer (WebRTC);
 * the server only relays SDP/ICE. There is NO MediaRecorder, no canvas capture,
 * no upload of frames — nothing about this call is ever stored. The only thing
 * persisted (by the caller's onComplete handler) is booleans + timestamps.
 *
 * Signaling here uses a simple polling transport against /api/signaling for dev.
 * Swap `SignalingTransport` for a realtime provider in production.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  initCall, reduceCall, canConfirm,
  type CallState, type SignalMessage, type ChecklistAck,
} from "@/lib/premeet-signaling";

type Props = {
  callId: string;
  selfId: string;
  peerId: string;
  isInitiator: boolean;
  onComplete: (result: { checklist: ChecklistAck; bothConfirmed: boolean }) => void;
};

const STUN = [{ urls: "stun:stun.l.google.com:19302" }];

const CHECKLIST_ITEMS: { key: keyof ChecklistAck; label: string }[] = [
  { key: "publicPlaceAgreed", label: "We agreed on a public place to meet" },
  { key: "trustedContactShared", label: "I've shared my plan with a trusted contact" },
  { key: "boundariesDiscussed", label: "We talked through boundaries & protection" },
];

export function PreMeetCall({ callId, selfId, peerId, isInitiator, onComplete }: Props) {
  const [call, setCall] = useState<CallState>(() => initCall(selfId, peerId));
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const sinceRef = useRef(0);
  const localStreamRef = useRef<MediaStream | null>(null);

  const post = useCallback(
    (msg: SignalMessage) =>
      fetch("/api/signaling", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ callId, msg }),
      }),
    [callId],
  );

  // set up peer connection + local media
  useEffect(() => {
    let stop = false;
    const pc = new RTCPeerConnection({ iceServers: STUN });
    pcRef.current = pc;

    pc.onicecandidate = (e) => {
      if (e.candidate) post({ t: "ice", candidate: e.candidate.toJSON(), from: selfId });
    };
    pc.ontrack = (e) => {
      if (remoteRef.current) remoteRef.current.srcObject = e.streams[0];
    };

    (async () => {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (stop) return;
      localStreamRef.current = stream;
      if (localRef.current) localRef.current.srcObject = stream;
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      if (isInitiator) {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        post({ t: "offer", sdp: offer.sdp!, from: selfId });
        setCall((c) => reduceCall(c, { t: "offer", sdp: offer.sdp!, from: selfId }));
      }
    })();

    return () => {
      stop = true;
      localStreamRef.current?.getTracks().forEach((t) => t.stop());
      pc.close();
    };
  }, [isInitiator, post, selfId]);

  // poll signaling
  useEffect(() => {
    const id = setInterval(async () => {
      const pc = pcRef.current;
      if (!pc) return;
      const r = await fetch(`/api/signaling?callId=${callId}&since=${sinceRef.current}`);
      const { messages, last } = await r.json();
      sinceRef.current = last;
      for (const msg of messages as SignalMessage[]) {
        if (msg.from === selfId) continue;
        if (msg.t === "offer") {
          await pc.setRemoteDescription({ type: "offer", sdp: msg.sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          post({ t: "answer", sdp: answer.sdp!, from: selfId });
          setCall((c) => reduceCall(c, msg));
        } else if (msg.t === "answer") {
          await pc.setRemoteDescription({ type: "answer", sdp: msg.sdp });
          setCall((c) => reduceCall(c, msg));
        } else if (msg.t === "ice") {
          try { await pc.addIceCandidate(msg.candidate); } catch {}
        } else {
          setCall((c) => reduceCall(c, msg));
        }
      }
    }, 1200);
    return () => clearInterval(id);
  }, [callId, post, selfId]);

  // fire onComplete when the call resolves
  useEffect(() => {
    if (call.phase === "ready_to_meet") {
      onComplete({ checklist: call.checklist, bothConfirmed: true });
    }
  }, [call.phase, call.checklist, onComplete]);

  const toggleItem = (key: keyof ChecklistAck) => {
    const ack = { ...call.checklist, [key]: !call.checklist[key] };
    setCall((c) => ({ ...c, checklist: ack }));
    post({ t: "checklist", ack, from: selfId });
  };

  const confirm = () => { post({ t: "confirm", from: selfId }); setCall((c) => reduceCall(c, { t: "confirm", from: selfId })); };
  const declineCall = () => { post({ t: "decline", from: selfId }); setCall((c) => reduceCall(c, { t: "decline", from: selfId })); };

  const allChecked = useMemo(() => CHECKLIST_ITEMS.every((i) => call.checklist[i.key]), [call.checklist]);

  return (
    <div className="mx-auto w-full max-w-md" style={{ color: "var(--fg)" }}>
      <div className="grid grid-cols-2 gap-2">
        <video ref={remoteRef} autoPlay playsInline className="aspect-[3/4] w-full rounded-2xl bg-black object-cover" />
        <video ref={localRef} autoPlay playsInline muted className="aspect-[3/4] w-full rounded-2xl bg-black object-cover" />
      </div>

      <p className="mt-3 text-center text-xs" style={{ color: "var(--text-muted)" }}>
        Live call · never recorded · {call.phase === "connecting" ? "connecting…" : call.phase}
      </p>

      {call.phase === "declined" ? (
        <p className="mt-6 text-center text-sm">Call ended — no plans made. That's always okay.</p>
      ) : call.phase === "ready_to_meet" ? (
        <p className="mt-6 text-center text-sm">You're both set. Meet safe — in public, plan shared.</p>
      ) : (
        <>
          <div className="mt-5 space-y-2">
            {CHECKLIST_ITEMS.map((item) => (
              <button
                key={item.key}
                onClick={() => toggleItem(item.key)}
                className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm"
                style={{
                  borderColor: call.checklist[item.key] ? "rgba(232,145,91,0.45)" : "rgba(255,255,255,0.1)",
                  background: call.checklist[item.key] ? "rgba(232,145,91,0.1)" : "rgba(255,255,255,0.03)",
                }}
              >
                <span
                  className="flex h-5 w-5 items-center justify-center rounded-md text-xs"
                  style={{ background: call.checklist[item.key] ? "var(--ember)" : "transparent", border: "1px solid rgba(232,145,91,0.5)", color: "var(--on-ember)" }}
                >
                  {call.checklist[item.key] ? "✓" : ""}
                </span>
                {item.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex gap-3">
            <button onClick={declineCall} className="flex-1 rounded-full border py-3 text-sm" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              Not feeling it
            </button>
            <button
              onClick={confirm}
              disabled={!canConfirm(call)}
              className="flex-1 rounded-full py-3 text-sm font-medium disabled:opacity-40"
              style={{ background: "linear-gradient(180deg,var(--ember-bright),var(--ember-deep))", color: "var(--on-ember)" }}
            >
              {call.confirmed[selfId] ? "Waiting on them…" : "We'll meet"}
            </button>
          </div>
          {!allChecked && (
            <p className="mt-2 text-center text-xs" style={{ color: "var(--text-faint)" }}>
              Work through the checklist together to enable “We'll meet”. Either of you can stop anytime.
            </p>
          )}
        </>
      )}
    </div>
  );
}
