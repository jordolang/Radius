"use client";
import { useEffect, useState } from "react";
import { ProfileForm } from "@/components/profile-form";
import { PreferencesForm } from "@/components/preferences-form";
import { AuthGate } from "@/components/auth/auth-gate";
import { PageHeader, StatusScreen, PrimaryLink } from "@/components/ui";

type Step = "alias" | "profile" | "absolutes" | "done";

function OnboardingFlow({ userId }: { userId: string }) {
  const [choices, setChoices] = useState<string[]>([]);
  const [alias, setAlias] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("alias");

  useEffect(() => {
    fetch(`/api/identity`).then((r) => r.json()).then((o) => setChoices(o.choices ?? []));
  }, []);

  const claim = async (pick: string) => {
    const r = await fetch("/api/identity", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ choices, pick }),
    });
    const d = await r.json();
    if (r.ok) { setAlias(d.alias); setStep("profile"); }
  };

  if (step === "done") {
    return (
      <StatusScreen title="You're all set" action={<PrimaryLink href="/" block>Go available</PrimaryLink>}>
        Profile saved and your absolutes are set. Head back to flip on availability whenever you&apos;re in the mood.
      </StatusScreen>
    );
  }

  const intro =
    step === "alias" ? "Pick a pseudonym. Your real name is never stored or shown."
    : step === "profile" ? "Add a masked photo and a few details. Everything here stays anonymous."
    : "Last step: set your absolutes. People outside them never reach you.";

  return (
    <div>
      <PageHeader title={step === "absolutes" ? "Your absolutes" : "Set up your profile"}>{intro}</PageHeader>

      {step === "alias" && (
        <div className="flex flex-wrap gap-2">
          {choices.map((c) => (
            <button key={c} onClick={() => claim(c)} className="chip">{c}</button>
          ))}
        </div>
      )}

      {step === "profile" && alias && (
        <ProfileForm userId={userId} alias={alias} onSaved={() => setStep("absolutes")} />
      )}

      {step === "absolutes" && (
        <PreferencesForm userId={userId} onSaved={() => setStep("done")} />
      )}
    </div>
  );
}

export default function Onboarding() {
  return <AuthGate>{(userId) => <OnboardingFlow userId={userId} />}</AuthGate>;
}
