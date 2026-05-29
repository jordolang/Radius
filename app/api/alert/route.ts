/**
 * GET /api/alert?userId=...  -> anonymous proximity nudge.
 *
 * Returns ONLY { someoneNearbyAvailable: boolean }. No ids, no avatars, no
 * count, no location. This is deliberate: a count or list would let someone
 * enumerate or de-anonymize who is signaling availability nearby.
 */

import { NextRequest, NextResponse } from "next/server";
import { proximityAlert } from "@/lib/presence";
import { presenceStore } from "@/lib/store";

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const alert = await proximityAlert(presenceStore, userId);
  return NextResponse.json(alert);
}
