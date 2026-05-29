"use client";
import { use, useEffect, useState } from "react";
import { Chat } from "@/components/chat";
import { PreMeetCall } from "@/components/premeet-call";
import { SafetyReport } from "@/components/safety-report";
import { demoUserId } from "@/lib/demo-user";

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [uid, setUid] = useState("");
  const [stage, setStage] = useState("candidate");
  const [canChat, setCanChat] = useState(false);
  const [canMedia, setCanMedia] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [a, b] = id.split("__");
  const peerId = uid === a ? b : a;

  const act = async (action: string, allow?: boolean) => {
    const r = await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, a, b, userId: uid, allow }) });
    const d = await r.json();
    setStage(d.stage); setCanChat(d.canChat); setCanMedia(d.canShareRealMedia);
  };

  useEffect(() => { setUid(demoUserId()); }, []);
  useEffect(() => { if (uid) act("interest"); /* eslint-disable-next-line */ }, [uid]);

  if (inCall) {
    return <PreMeetCall callId={id} selfId={uid} peerId={peerId} isInitiator={uid === a}
      onComplete={() => setInCall(false)} />;
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl">Connection</h1>
      <p className="mb-4 text-sm" style={{ color: "rgba(232,200,180,0.55)" }}>Stage: {stage}</p>

      {!canChat ? (
        <div className="rounded-2xl border p-4 text-sm" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          You've shown interest. Chat and avatars unlock only when they do too — no one is revealed one-sidedly.
        </div>
      ) : (
        <>
          <Chat matchId={id} selfId={uid} peerId={peerId} selfAlias="You" peerAlias="Them" canShareMedia={canMedia} />
          {!canMedia && (
            <button onClick={() => act("content_consent", true)} className="mt-3 text-xs underline" style={{ color: "#e8915b" }}>
              I consent to sharing one-time media (they must too)
            </button>
          )}
          <div className="mt-5 flex gap-2">
            <button onClick={() => setInCall(true)} className="flex-1 rounded-full py-3 text-sm font-medium" style={{ background: "linear-gradient(180deg,#ef9a63,#d6713f)", color: "#1a0e08" }}>
              Start pre-meet call
            </button>
            <button onClick={() => setShowReport((v) => !v)} className="rounded-full border px-4 text-sm" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
              Report
            </button>
          </div>
          {showReport && <div className="mt-4"><SafetyReport reporterId={uid} reportedId={peerId} onDone={() => setShowReport(false)} /></div>}
        </>
      )}
    </div>
  );
}
