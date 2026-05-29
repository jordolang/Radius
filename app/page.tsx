"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AvailabilityToggle } from "@/components/availability-toggle";
import { BeaconMode } from "@/components/beacon-mode";
import { demoUserId } from "@/lib/demo-user";

export default function Home() {
  const [uid, setUid] = useState("");
  useEffect(() => setUid(demoUserId()), []);
  if (!uid) return null;
  return (
    <div>
      <header className="mb-6">
        <h1 className="text-4xl" style={{ color: "#f6ece4" }}>In The Mood</h1>
        <p className="mt-1 text-sm" style={{ color: "rgba(232,200,180,0.55)" }}>
          Anonymous, consent-first introductions. You're a pseudonym and a masked avatar until you both choose otherwise.
        </p>
      </header>
      <AvailabilityToggle userId={uid} />
      <BeaconMode userId={uid} />
      <nav className="mt-6 grid grid-cols-3 gap-2 text-center text-sm">
        <Link href="/onboarding" className="rounded-xl border py-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>Profile</Link>
        <Link href="/discover" className="rounded-xl border py-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>Discover</Link>
        <Link href="/plan" className="rounded-xl border py-3" style={{ borderColor: "rgba(255,255,255,0.12)" }}>Plan ahead</Link>
      </nav>
    </div>
  );
}
