"use client";

/**
 * Discover — the hub for every interaction with potential matches.
 *
 * Top half: a brief overview + quick links to conversations, past matches, the
 * archive, and Pro. Bottom half: the live interactions (people in your radius
 * right now / responding to you) plus the discovery controls (search area +
 * acceptable meetup arrangements). Paid (Pro) is stubbed until launch.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AuthGate } from "@/components/auth/auth-gate";
import { MEETUP_OPTIONS, useDiscoverySettings } from "@/lib/use-discovery-settings";

type PanelId = "chats" | "updates" | "past" | "archive" | "pro";

interface Alert {
  matchId: string;
}

const LINKS: { id: PanelId; label: string; icon: string }[] = [
  { id: "chats", label: "Chats", icon: "💬" },
  { id: "updates", label: "Updates", icon: "🔔" },
  { id: "past", label: "Past matches", icon: "🕯️" },
  { id: "archive", label: "Archive", icon: "🗄️" },
  { id: "pro", label: "Go Pro", icon: "✦" },
];

const PANEL_EMPTY: Record<Exclude<PanelId, "pro">, string> = {
  chats: "No conversations yet. When you and a match both opt in, your chat opens here.",
  updates: "No new activity. Replies and new sparks will surface here.",
  past: "No past matches yet. People you've connected with will be listed here.",
  archive: "Nothing archived. Conversations you tuck away land here.",
};

function DiscoverHub() {
  const router = useRouter();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const { settings, setRadius, toggleMeetup } = useDiscoverySettings();

  useEffect(() => {
    const tick = () =>
      fetch(`/api/beacon`).then((r) => r.json()).then((d) => setAlerts(d.alerts ?? [])).catch(() => {});
    tick();
    const t = setInterval(tick, 12000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Top half: overview + quick links ── */}
      <section>
        <header className="mb-3 flex items-baseline justify-between">
          <h1 className="page-title">Discover</h1>
          <span className="eyebrow">Radius</span>
        </header>

        <div className="card card-ember">
          <p className="text-sm" style={{ color: "var(--fg)" }}>
            {alerts.length > 0
              ? `${alerts.length} ${alerts.length === 1 ? "person" : "people"} in your radius right now.`
              : "No one in your radius this moment."}
          </p>
          <p className="help-text mt-1">Everything you do with potential matches lives here.</p>
        </div>

        <div className="mt-3 grid grid-cols-5 gap-2">
          {LINKS.map((l) => (
            <button
              key={l.id}
              onClick={() => setPanel((p) => (p === l.id ? null : l.id))}
              className="flex flex-col items-center gap-1 rounded-xl border py-3"
              style={{
                borderColor: panel === l.id ? "var(--ember-line)" : "var(--border)",
                background: panel === l.id ? "var(--ember-tint)" : "transparent",
              }}
            >
              <span className="text-lg" aria-hidden>{l.icon}</span>
              <span className="text-[10px] leading-tight" style={{ color: "var(--fg-soft)" }}>{l.label}</span>
            </button>
          ))}
        </div>

        {panel && (
          <div className="card mt-3">
            {panel === "pro" ? (
              <div>
                <p className="section-title">Radius Pro</p>
                <p className="help-text mt-1">
                  Wider search, priority beacons, and more — rolling out after launch.
                </p>
                <span
                  className="mt-2 inline-block rounded-full px-3 py-1 text-xs"
                  style={{ background: "var(--ember-tint)", color: "var(--ember)", border: "1px solid var(--ember-line)" }}
                >
                  Coming soon
                </span>
              </div>
            ) : (
              <p className="faint text-sm">{PANEL_EMPTY[panel]}</p>
            )}
          </div>
        )}
      </section>

      <hr style={{ borderColor: "var(--border-soft)" }} />

      {/* ── Bottom half: live interactions + controls ── */}
      <section className="space-y-4">
        <div>
          <p className="section-title mb-2">In your radius now</p>
          {alerts.length === 0 ? (
            <p className="faint text-sm">
              No one nearby right now. Turn on availability and keep beacon mode on to get pinged.
            </p>
          ) : (
            <div className="space-y-2">
              {alerts.map((a) => (
                <button
                  key={a.matchId}
                  onClick={() => router.push(`/match/${a.matchId}`)}
                  className="card card-ember flex w-full items-center justify-between text-left"
                >
                  <span className="text-sm">Someone nearby is available &amp; fits both your absolutes</span>
                  <span className="text-sm" style={{ color: "var(--ember)" }}>Explore →</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search-area control */}
        <div className="card">
          <div className="flex items-baseline justify-between">
            <span className="section-title">Search area</span>
            <span className="text-sm" style={{ color: "var(--ember)" }}>{settings.radiusMiles} mi</span>
          </div>
          <input
            type="range" min={1} max={25} value={settings.radiusMiles} className="abs-range mt-3"
            aria-label="Search radius in miles"
            onChange={(e) => setRadius(Number(e.target.value))}
          />
          <p className="help-text mt-2">How far out to look for available people.</p>
        </div>

        {/* Meetup specifications */}
        <div className="card">
          <span className="section-title">Meetup preferences</span>
          <p className="help-text mt-1">What you&apos;re open to. Shared only after a mutual match.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {MEETUP_OPTIONS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => toggleMeetup(m.id)}
                className={`chip btn-sm ${settings.meetup.includes(m.id) ? "chip-on" : ""}`}
                aria-pressed={settings.meetup.includes(m.id)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export default function Discover() {
  return <AuthGate>{() => <DiscoverHub />}</AuthGate>;
}
