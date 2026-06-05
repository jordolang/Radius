/**
 * POST /api/presence  -> go available.  Body: { cell, ttlMs? }
 *   NOTE: `cell` is ALREADY a coarse geocell computed on the client via
 *   lib/geo.toCoarseCell(). Raw lat/lng must never be sent to the server.
 *   Identity is taken from the Clerk session, never the body.
 *
 * DELETE /api/presence -> go unavailable immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import { goAvailable, goUnavailable } from "@/lib/presence";
import { presenceStore } from "@/lib/db/repo";
import { getUserIdEnsured } from "@/lib/auth";
import { cellCenter } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { cell, ttlMs } = await req.json();
  if (typeof cell !== "string") {
    return NextResponse.json({ error: "coarse cell required" }, { status: 400 });
  }
  // Reject anything that smells like a precise coordinate sneaking in.
  if (/-?\d+\.\d{3,}/.test(cell)) {
    return NextResponse.json(
      { error: "cell must be a coarse geocell, not raw coordinates" },
      { status: 422 },
    );
  }
  try {
    // Reconstruct lat/lng from the cell CENTER (already coarse); goAvailable
    // re-quantizes, so this is the fuzzed center, never a real point.
    const { lat, lng } = cellCenter(cell);
    const presence = await goAvailable(presenceStore, userId, lat, lng, ttlMs);
    return NextResponse.json({ ok: true, expiresAt: presence.expiresAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

export async function DELETE() {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  await goUnavailable(presenceStore, userId);
  return NextResponse.json({ ok: true });
}
