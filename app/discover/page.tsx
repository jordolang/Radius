"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { demoUserId } from "@/lib/demo-user";

export default function Discover() {
  const [uid, setUid] = useState("");
  const [alerts, setAlerts] = useState<{ matchId: string }[]>([]);
  const router = useRouter();

  useEffect(() => { const id = demoUserId(); setUid(id);
    const tick = () => fetch(`/api/beacon?userId=${id}`).then((r) => r.json()).then((d) => setAlerts(d.alerts ?? []));
    tick(); const t = setInterval(tick, 12000); return () => clearInterval(t); }, []);

  const explore = async (matchId: string) => {
    const [a, b] = matchId.split("__");
    await fetch("/api/match", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "interest", a, b, userId: uid }) });
    router.push(`/match/${matchId}`);
  };

  return (
    <div>
      <h1 className="mb-1 text-3xl">Nearby</h1>
      <p className="mb-5 text-sm" style={{ color: "rgba(232,200,180,0.55)" }}>
        Everyone here opted in and is available now. Tap to show interest — they only learn it's mutual if they tap back.
      </p>
      {alerts.length === 0 ? (
        <p className="text-sm" style={{ color: "rgba(232,200,180,0.45)" }}>No one nearby right now. Turn on availability and keep beacon mode on.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <button key={a.matchId} onClick={() => explore(a.matchId)}
              className="flex w-full items-center justify-between rounded-2xl border px-4 py-4"
              style={{ borderColor: "rgba(232,145,91,0.35)", background: "rgba(232,145,91,0.07)" }}>
              <span className="text-sm">Someone nearby is available</span>
              <span className="text-sm" style={{ color: "#e8915b" }}>Explore →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
