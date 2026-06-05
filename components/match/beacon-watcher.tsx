"use client";

/**
 * BeaconWatcher — mounts the signature MatchAlert whenever the beacon reports a
 * compatible, available person nearby. Accepting routes into the spark decision
 * flow for that pair; dismissing remembers it so you aren't nagged again.
 *
 * Drop this near the app root (e.g. the home screen). It renders nothing until
 * an alert actually fires.
 */

import { useRouter } from "next/navigation";
import { MatchAlert } from "./match-alert";
import { useBeaconAlerts } from "./use-beacon-alerts";

export function BeaconWatcher({ userId }: { userId: string }) {
  const router = useRouter();
  const { alert, dismiss } = useBeaconAlerts(userId, true);

  if (!alert) return null;

  return (
    <MatchAlert
      onAccept={() => {
        const id = alert.matchId;
        dismiss();
        router.push(`/match/${id}`);
      }}
      onDismiss={dismiss}
    />
  );
}
