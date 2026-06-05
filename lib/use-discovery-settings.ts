"use client";

/**
 * useDiscoverySettings — the user's discovery controls: how wide to search and
 * which meetup arrangements they'll consider.
 *
 * These are stored on-device for now (localStorage); they're personal filters
 * that don't need to leave the phone until matching consumes them server-side.
 * Kept here so the Discover screen stays declarative.
 */

import { useEffect, useState } from "react";

export const MEETUP_OPTIONS = [
  { id: "your_place", label: "Your place" },
  { id: "their_place", label: "Their place" },
  { id: "hotel", label: "Hotel required" },
  { id: "public_first", label: "Public meetup first" },
  { id: "daytime_only", label: "Daytime / public only" },
] as const;

export type MeetupId = (typeof MEETUP_OPTIONS)[number]["id"];

export interface DiscoverySettings {
  radiusMiles: number; // how far out to look
  meetup: MeetupId[]; // acceptable arrangements
}

const KEY = "radius.discovery.v1";
const DEFAULTS: DiscoverySettings = { radiusMiles: 5, meetup: ["public_first"] };

export function useDiscoverySettings() {
  const [settings, setSettings] = useState<DiscoverySettings>(DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setSettings({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* keep defaults */
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(KEY, JSON.stringify(settings));
  }, [settings, loaded]);

  const setRadius = (radiusMiles: number) => setSettings((s) => ({ ...s, radiusMiles }));
  const toggleMeetup = (id: MeetupId) =>
    setSettings((s) => ({
      ...s,
      meetup: s.meetup.includes(id) ? s.meetup.filter((m) => m !== id) : [...s.meetup, id],
    }));

  return { settings, loaded, setRadius, toggleMeetup };
}
