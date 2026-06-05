"use client";

import { useState } from "react";
import { scanForPii, redactPii, shouldBlock } from "@/lib/pii-guard";
import { PrimaryButton } from "@/components/ui";

type Msg = { id: string; from: string; text?: string; ephemeralId?: string };

export function Chat({ matchId, selfId, peerId, selfAlias, peerAlias, canShareMedia }: {
  matchId: string; selfId: string; peerId: string; selfAlias: string; peerAlias: string; canShareMedia: boolean;
}) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [warn, setWarn] = useState<string | null>(null);

  const send = () => {
    const findings = scanForPii(text);
    if (findings.length) {
      if (shouldBlock(findings)) { setWarn("That looks like a street address — sharing exact locations isn't allowed here."); return; }
      const { redacted } = redactPii(text);
      setWarn("We hid some personal info to keep you anonymous. Sent the safe version.");
      setMsgs((m) => [...m, { id: crypto.randomUUID(), from: selfId, text: redacted }]);
      setText(""); return;
    }
    setWarn(null);
    setMsgs((m) => [...m, { id: crypto.randomUUID(), from: selfId, text }]);
    setText("");
  };

  const sendEphemeral = async () => {
    const r = await fetch("/api/ephemeral", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ matchId, senderId: selfId, recipientId: peerId }) });
    const d = await r.json();
    if (!r.ok) { setWarn(d.error); return; }
    setMsgs((m) => [...m, { id: crypto.randomUUID(), from: selfId, ephemeralId: d.id }]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="space-y-2">
        {msgs.map((m) => (
          <div key={m.id} className="max-w-[80%] rounded-2xl px-3 py-2 text-sm"
            style={{ alignSelf: m.from === selfId ? "flex-end" : "flex-start",
                     marginLeft: m.from === selfId ? "auto" : 0,
                     background: m.from === selfId ? "var(--ember-tint)" : "rgba(255,255,255,0.05)" }}>
            {m.text}
            {m.ephemeralId && (
              <div className="muted mt-1 text-xs">
                Sent a one-time photo · press &amp; hold to view, then it&apos;s gone
              </div>
            )}
          </div>
        ))}
      </div>

      {warn && <p className="error-text">{warn}</p>}

      <div className="flex gap-2">
        <input value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()}
          placeholder={`Message ${peerAlias}…`}
          className="flex-1 rounded-full border bg-transparent px-4 py-2 text-sm"
          style={{ borderColor: "var(--border)" }} />
        <PrimaryButton className="btn-sm" onClick={send}>Send</PrimaryButton>
      </div>

      {canShareMedia ? (
        <button onClick={sendEphemeral} className="link-ember text-xs">
          Send a one-time photo (disappears after one view)
        </button>
      ) : (
        <p className="faint text-xs">
          Both of you must opt in to media sharing before photos can be sent.
        </p>
      )}
    </div>
  );
}
