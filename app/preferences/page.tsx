"use client";
import { useState } from "react";
import { PreferencesForm } from "@/components/preferences-form";
import { AuthGate } from "@/components/auth/auth-gate";
import { PageHeader, PrimaryLink } from "@/components/ui";

function Absolutes({ userId }: { userId: string }) {
  const [saved, setSaved] = useState(false);
  return (
    <div>
      <PageHeader title="Your absolutes">
        Dial in who can reach you. Anyone outside these ranges never matches you and
        never gets an alert — and the filter is mutual.
      </PageHeader>

      <PreferencesForm userId={userId} onSaved={() => setSaved(true)} />

      {saved && (
        <div className="mt-5">
          <PrimaryLink href="/" block>Back to the map</PrimaryLink>
        </div>
      )}
    </div>
  );
}

export default function PreferencesPage() {
  return <AuthGate>{(userId) => <Absolutes userId={userId} />}</AuthGate>;
}
