import { NextRequest, NextResponse } from "next/server";
import {
  bandForHeight, validateProfile, sanitizeBioMessages, sanitizeRevealPhotos, type Profile,
} from "@/lib/profile";
import { getProfile, putProfile } from "@/lib/db/repo";
import { getUserId, getUserIdEnsured } from "@/lib/auth";

// GET /api/profile  -> the signed-in user's profile (or null if not set up yet)
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const profile = await getProfile(userId);
  return NextResponse.json({ profile });
}

// POST /api/profile  (full profile JSON; avatarUrl from /api/profile/avatar)
export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const body = (await req.json()) as Partial<Profile>;
  body.userId = userId; // identity comes from the session, never the request body

  // Derive the coarse display band from the exact height the client collects.
  if (typeof body.heightInches === "number") {
    body.heightBand = bandForHeight(body.heightInches);
  }

  // Cap/clean the free-form gallery + bio lines before they ever hit the store.
  body.bioMessages = sanitizeBioMessages(body.bioMessages);
  body.revealPhotos = sanitizeRevealPhotos(body.revealPhotos);

  const v = validateProfile(body);
  if (!v.ok) return NextResponse.json({ errors: v.errors }, { status: 422 });

  await putProfile({ ...(body as Profile), createdAt: Date.now() });
  return NextResponse.json({ ok: true });
}
