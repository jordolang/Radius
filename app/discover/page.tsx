"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { AuthGate } from "@/components/auth/auth-gate";

function DiscoverList() {
  const [alerts, setAlerts] = useState<{ matchId: string }[]>([]);
  const router = useRouter();

  useEffect(() => {
    const tick = () => fetch(`/api/beacon`).then((r) => r.json()).then((d) => setAlerts(d.alerts ?? []));
    tick();
    const t = setInterval(tick, 12000);
    return () => clearInterval(t);
  }, []);

  // Open the spark decision flow for this pair. We do NOT opt in here — interest
  // is expressed explicitly on the decision card, so nothing reveals prematurely.
  const explore = (matchId: string) => router.push(`/match/${matchId}`);

  return (
    <div>
      <PageHeader title="Nearby">
        Everyone here opted in, is available now, and fits both your absolutes. Tap to see them — they only learn it&apos;s mutual if they tap back.
      </PageHeader>
      {alerts.length === 0 ? (
        <p className="faint text-sm">No one nearby right now. Turn on availability and keep beacon mode on.</p>
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <button key={a.matchId} onClick={() => explore(a.matchId)}
              className="card card-ember flex w-full items-center justify-between text-left">
              <span className="text-sm">Someone nearby is available</span>
              <span className="text-sm" style={{ color: "var(--ember)" }}>Explore →</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Discover() {
  return <AuthGate>{() => <DiscoverList />}</AuthGate>;
}
