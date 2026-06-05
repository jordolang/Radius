/**
 * GET /api/alert  -> anonymous proximity nudge for the signed-in user.
 *
 * Returns ONLY { someoneNearbyAvailable: boolean }. No ids, no avatars, no
 * count, no location. This is deliberate: a count or list would let someone
 * enumerate or de-anonymize who is signaling availability nearby.
 */

import { NextResponse } from "next/server";
import { proximityAlert } from "@/lib/presence";
import { presenceStore } from "@/lib/db/repo";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const alert = await proximityAlert(presenceStore, userId);
  return NextResponse.json(alert);
}
