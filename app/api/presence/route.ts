/**
 * POST /api/presence  -> go available.  Body: { userId, cell, ttlMs? }
 *   NOTE: `cell` is ALREADY a coarse geocell computed on the client via
 *   lib/geo.toCoarseCell(). Raw lat/lng must never be sent to the server.
 *
 * DELETE /api/presence -> go unavailable immediately.  Body: { userId }
 */

import { NextRequest, NextResponse } from "next/server";
import { goAvailable, goUnavailable } from "@/lib/presence";
import { presenceStore } from "@/lib/store";
import { cellCenter } from "@/lib/geo";

export async function POST(req: NextRequest) {
  const { userId, cell, ttlMs } = await req.json();
  if (!userId || typeof cell !== "string") {
    return NextResponse.json({ error: "userId and coarse cell required" }, { status: 400 });
  }
  // Reject anything that smells like a precise coordinate sneaking in.
  if (/-?\d+\.\d{3,}/.test(cell)) {
    return NextResponse.json(
      { error: "cell must be a coarse geocell, not raw coordinates" },
      { status: 422 },
    );
  }
  try {
    // We reconstruct lat/lng from the cell CENTER (already coarse) only because
    // goAvailable re-quantizes; the value is the fuzzed center, not a real point.
    const { lat, lng } = cellCenter(cell);
    const presence = await goAvailable(presenceStore, userId, lat, lng, ttlMs);
    return NextResponse.json({ ok: true, expiresAt: presence.expiresAt });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 403 });
  }
}

export async function DELETE(req: NextRequest) {
  const { userId } = await req.json();
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  await goUnavailable(presenceStore, userId);
  return NextResponse.json({ ok: true });
}
