"use client";
import { useState } from "react";
import { PageHeader, PrimaryButton, SecondaryButton } from "@/components/ui";
import { AuthGate } from "@/components/auth/auth-gate";
import { PLAN_LEAD_OPTIONS, leadPhrase, type PlanLeadHours } from "@/lib/planahead";

interface CreatedPlan {
  key: string;
  label?: string;
  phrase?: string;
}

function PlanAhead() {
  const [zip, setZip] = useState("");
  const [leadHours, setLeadHours] = useState<PlanLeadHours>(4);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<CreatedPlan | null>(null);

  const validZip = /^\d{5}$/.test(zip);

  const broadcast = async () => {
    setBusy(true);
    setError(null);
    setPlan(null);
    try {
      const r = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zip, leadHours }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error ?? "Couldn't create the plan."); return; }
      setPlan({ key: d.key, label: d.label, phrase: d.phrase });
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!plan) return;
    await fetch("/api/plan", {
      method: "DELETE", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: plan.key }),
    });
    setPlan(null);
  };

  if (plan) {
    return (
      <div>
        <PageHeader title="You're on the radar">
          People in that area will see a future, tentative presence — grayed out, never an exact spot or time.
        </PageHeader>
        <div className="card card-ember">
          <p className="eyebrow">Future plan mode</p>
          <p className="mt-2 text-lg" style={{ color: "var(--fg)" }}>
            You&apos;ll show as present{" "}
            <span style={{ color: "var(--ember)" }}>{plan.phrase ?? "soon"}</span>
            {plan.label ? <> near <span style={{ color: "var(--ember)" }}>{plan.label}</span></> : null}.
          </p>
          <p className="help-text mt-2">
            Broadcast from the ZIP&apos;s ~5-mile area only. Backing out is always free.
          </p>
        </div>
        <div className="mt-4">
          <SecondaryButton block onClick={cancel}>Cancel this plan</SecondaryButton>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Plan ahead">
        Heading somewhere later? Broadcast a future presence from a ZIP&apos;s area —
        up to 24h out. We never use an exact address, only the ZIP&apos;s ~5-mile cell.
      </PageHeader>

      <label className="block">
        <span className="field-label">ZIP code</span>
        <input
          value={zip}
          onChange={(e) => setZip(e.target.value.replace(/\D/g, "").slice(0, 5))}
          inputMode="numeric"
          placeholder="e.g. 48104"
          className="input text-lg tracking-widest"
        />
      </label>

      <div className="mt-4">
        <span className="field-label">How far ahead?</span>
        <div className="mt-2 space-y-2">
          {PLAN_LEAD_OPTIONS.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() => setLeadHours(h)}
              className="flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left"
              style={{
                borderColor: leadHours === h ? "var(--ember-line)" : "var(--border)",
                background: leadHours === h ? "var(--ember-tint)" : "transparent",
              }}
              aria-pressed={leadHours === h}
            >
              <span
                className="flex h-5 w-5 items-center justify-center rounded-full border"
                style={{ borderColor: leadHours === h ? "var(--ember)" : "var(--border)" }}
              >
                {leadHours === h && (
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: "var(--ember)" }} />
                )}
              </span>
              <span className="flex-1 text-sm">
                <span style={{ color: "var(--fg)" }}>{h} hours</span>
                <span className="faint"> · present {leadPhrase(h)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {error && <p className="error-text mt-3">{error}</p>}

      <div className="mt-5">
        <PrimaryButton block onClick={broadcast} disabled={!validZip || busy} className="!py-4 text-base">
          {busy ? "Broadcasting…" : "Broadcast my plan"}
        </PrimaryButton>
        {!validZip && zip.length > 0 && <p className="help-text mt-2">Enter a 5-digit ZIP code.</p>}
      </div>
    </div>
  );
}

export default function Plan() {
  return <AuthGate>{() => <PlanAhead />}</AuthGate>;
}
