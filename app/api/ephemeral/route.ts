import { NextRequest, NextResponse } from "next/server";
import { createItem, beginView, endView, refresh, canCreateShare } from "@/lib/ephemeral";
import { putItem, getItem, deleteItemBlob, getMatch, getProfile } from "@/lib/store";
import { canShareRealMedia } from "@/lib/match";

// POST /api/ephemeral  { matchId, senderId, recipientId }  -> create one-time item
export async function POST(req: NextRequest) {
  const { matchId, senderId, recipientId } = await req.json();
  const match = getMatch(matchId);
  if (!match) return NextResponse.json({ error: "match not found" }, { status: 404 });
  const gate = {
    bothContentConsent: canShareRealMedia(match),
    senderAgeVerified: !!getProfile(senderId),     // dev proxy; real: verified flag
    recipientAgeVerified: !!getProfile(recipientId),
  };
  const g = canCreateShare(gate);
  if (!g.ok) return NextResponse.json({ error: g.reason }, { status: 403 });
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  putItem(createItem({ id, matchId, senderId, recipientId }));
  return NextResponse.json({ ok: true, id });
}

// GET /api/ephemeral?id=&viewerId=  -> begin a single view
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id")!;
  const viewerId = req.nextUrl.searchParams.get("viewerId")!;
  const item = getItem(id);
  if (!item) return NextResponse.json({ error: "gone" }, { status: 410 });
  const { item: next, granted, reason } = beginView(refresh(item), viewerId);
  putItem(next);
  if (!granted) return NextResponse.json({ error: reason }, { status: 403 });
  return NextResponse.json({ ok: true }); // real impl returns a short-lived signed URL
}

// DELETE /api/ephemeral  { id }  -> end view; destroy if spent
export async function DELETE(req: NextRequest) {
  const { id } = await req.json();
  const item = getItem(id);
  if (!item) return NextResponse.json({ ok: true });
  const next = endView(item);
  putItem(next);
  if (next.state === "destroyed" || next.state === "expired") deleteItemBlob(id);
  return NextResponse.json({ ok: true, state: next.state });
}
