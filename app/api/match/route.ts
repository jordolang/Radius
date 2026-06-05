import { NextRequest, NextResponse } from "next/server";
import {
  createCandidate, expressInterest, decline, requirePreMeet,
  setContentSharingConsent, canSeeAvatar, canChat, canShareRealMedia,
} from "@/lib/match";
import { getMatch, putMatch, getProfile, areCompatible, ensureUser } from "@/lib/db/repo";
import { publicView } from "@/lib/profile";
import { getUserId } from "@/lib/auth";
import type { Match, UserId } from "@/lib/types";

/**
 * Client-facing view of a match. `otherProfile` (full) is gated to mutual
 * interest; before that a masked-avatar `teaser` is returned only for a pair
 * that mutually passes absolutes. `youInterested` reflects only the caller.
 */
async function viewFor(m: Match, userId: UserId) {
  const other = userId === m.a ? m.b : m.a;
  const canSee = canSeeAvatar(m);

  let teaser: { avatarUrl: string; age: number; heightBand: string; bodyType: string } | null = null;
  let otherProfile = null;

  if (canSee) {
    const op = await getProfile(other);
    otherProfile = op ? publicView(op) : null;
  } else if (await areCompatible(userId, other)) {
    const op = await getProfile(other);
    if (op) teaser = { avatarUrl: op.avatarUrl, age: op.age, heightBand: op.heightBand, bodyType: op.bodyType };
  }

  return {
    stage: m.stage,
    youInterested: Boolean(m.interested[userId]),
    canChat: canChat(m),
    canShareRealMedia: canShareRealMedia(m),
    teaser,
    otherProfile,
  };
}

function matchIdOf(a?: string | null, b?: string | null): string | null {
  return a && b ? [a, b].sort().join("__") : null;
}

// GET /api/match?a=&b=  -> read-only status (never opts you in)
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const a = req.nextUrl.searchParams.get("a");
  const b = req.nextUrl.searchParams.get("b");
  const id = matchIdOf(a, b);
  if (!id) return NextResponse.json({ error: "a, b required" }, { status: 400 });

  const m = (await getMatch(id)) ?? createCandidate(a!, b!);
  if (userId !== m.a && userId !== m.b) return NextResponse.json({ error: "not your match" }, { status: 403 });
  return NextResponse.json(await viewFor(m, userId));
}

// POST /api/match  { action, a, b, allow? }  (identity from session)
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { action, a, b, allow } = await req.json();
  const id = matchIdOf(a, b);
  if (!id) return NextResponse.json({ error: "a, b required" }, { status: 400 });

  let m = (await getMatch(id)) ?? createCandidate(a, b);
  if (userId !== m.a && userId !== m.b) return NextResponse.json({ error: "not your match" }, { status: 403 });

  // The absolutes filter is a hard gate even against direct access: you can't
  // express interest in someone outside either party's preferences.
  if (action === "interest" && !(await areCompatible(m.a, m.b))) {
    return NextResponse.json({ error: "outside one of your absolutes" }, { status: 403 });
  }

  switch (action) {
    case "interest": m = expressInterest(m, userId); break;
    case "decline": m = decline(m); break;
    case "premeet": m = requirePreMeet(m); break;
    case "content_consent": m = setContentSharingConsent(m, userId, !!allow); break;
    case "archive": m = { ...m, archived: true, updatedAt: Date.now() }; break;
    case "unarchive": m = { ...m, archived: false, updatedAt: Date.now() }; break;
    default: return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }

  // Both users must exist as rows before the match FKs resolve.
  await Promise.all([ensureUser(m.a), ensureUser(m.b)]);
  await putMatch(m);

  return NextResponse.json(await viewFor(m, userId));
}
