"use client";
import { use, useCallback, useState } from "react";
import { Chat } from "@/components/chat";
import { PreMeetCall } from "@/components/premeet-call";
import { SafetyReport } from "@/components/safety-report";
import { SparkDecision } from "@/components/match/spark-decision";
import { AuthGate } from "@/components/auth/auth-gate";
import { PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";

function MatchInner({ id, uid }: { id: string; uid: string }) {
  const [proceeded, setProceeded] = useState(false);
  const [canMedia, setCanMedia] = useState(false);
  const [inCall, setInCall] = useState(false);
  const [showReport, setShowReport] = useState(false);

  const [a, b] = id.split("__");
  const peerId = uid === a ? b : a;

  const act = useCallback(async (action: string, allow?: boolean) => {
    const r = await fetch("/api/match", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, a, b, allow }),
    });
    const d = await r.json();
    setCanMedia(Boolean(d.canShareRealMedia));
  }, [a, b]);

  if (inCall) {
    return <PreMeetCall callId={id} selfId={uid} peerId={peerId} isInitiator={uid === a}
      onComplete={() => setInCall(false)} />;
  }

  // Pre-chat: the alert-to-reveal matching interface. Nothing reveals until mutual.
  if (!proceeded) {
    return (
      <div>
        <PageHeader title="A spark nearby">Someone compatible is available in your radius.</PageHeader>
        <SparkDecision matchId={id} selfId={uid} onProceed={() => setProceeded(true)} />
      </div>
    );
  }

  // Post-reveal: the connection surface (chat -> pre-meet), unlocked by mutual interest.
  return (
    <div>
      <PageHeader title="Connection">You both sparked. Take it from here.</PageHeader>
      <Chat matchId={id} selfId={uid} peerId={peerId} selfAlias="You" peerAlias="Them" canShareMedia={canMedia} />
      {!canMedia && (
        <button onClick={() => act("content_consent", true)} className="link-ember mt-3 inline-block text-xs">
          I consent to sharing one-time media (they must too)
        </button>
      )}
      <div className="mt-5 flex gap-2">
        <PrimaryButton className="flex-1" onClick={() => setInCall(true)}>
          Start pre-meet call
        </PrimaryButton>
        <SecondaryButton className="btn-sm" onClick={() => setShowReport((v) => !v)}>
          Report
        </SecondaryButton>
      </div>
      {showReport && <div className="mt-4"><SafetyReport reporterId={uid} reportedId={peerId} onDone={() => setShowReport(false)} /></div>}
    </div>
  );
}

export default function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return <AuthGate>{(uid) => <MatchInner id={id} uid={uid} />}</AuthGate>;
}
