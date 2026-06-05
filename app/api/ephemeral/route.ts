import { NextRequest, NextResponse } from "next/server";
import { createItem, beginView, endView, refresh, canCreateShare, isGone } from "@/lib/ephemeral";
import { putItem, getItem, deleteItem, getMatch, isAgeVerified } from "@/lib/db/repo";
import { canShareRealMedia } from "@/lib/match";
import { getUserId, getUserIdEnsured } from "@/lib/auth";

// POST /api/ephemeral  { matchId, recipientId }  -> create one-time item (sender = session)
export async function POST(req: NextRequest) {
  const senderId = await getUserIdEnsured();
  if (!senderId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { matchId, recipientId } = await req.json();
  const match = await getMatch(matchId);
  if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });
  if (senderId !== match.a && senderId !== match.b) {
    return NextResponse.json({ error: "not your match" }, { status: 403 });
  }

  // Both must have consented to share real media AND both must be age-verified.
  // age verification is a real flag (users.age_verified) — not yet wired, so this
  // gate keeps intimate-media sharing OFF until verification exists. That's intended.
  const [senderAgeVerified, recipientAgeVerified] = await Promise.all([
    isAgeVerified(senderId), isAgeVerified(recipientId),
  ]);
  const g = canCreateShare({
    bothContentConsent: canShareRealMedia(match),
    senderAgeVerified,
    recipientAgeVerified,
  });
  if (!g.ok) return NextResponse.json({ error: g.reason }, { status: 403 });

  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await putItem(createItem({ id, matchId, senderId, recipientId }));
  return NextResponse.json({ ok: true, id });
}

// GET /api/ephemeral?id=  -> begin a single view (viewer = session)
export async function GET(req: NextRequest) {
  const viewerId = await getUserId();
  if (!viewerId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const item = await getItem(id);
  if (!item) return NextResponse.json({ error: "gone" }, { status: 410 });

  const { item: next, granted, reason } = beginView(refresh(item), viewerId);
  await putItem(next);
  if (!granted) return NextResponse.json({ error: reason }, { status: 403 });
  return NextResponse.json({ ok: true }); // real impl returns a short-lived signed URL
}

// DELETE /api/ephemeral  { id }  -> end view; destroy if spent
export async function DELETE(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { id } = await req.json();
  const item = await getItem(id);
  if (!item) return NextResponse.json({ ok: true });

  const next = endView(item);
  await putItem(next);
  if (isGone(next)) await deleteItem(id);
  return NextResponse.json({ ok: true, state: next.state });
}
