import { NextRequest, NextResponse } from "next/server";
import {
  createCandidate, expressInterest, decline, requirePreMeet,
  setContentSharingConsent, canSeeAvatar, canChat, canShareRealMedia,
} from "@/lib/match";
import { getMatch, putMatch, getProfile } from "@/lib/store";
import { publicView } from "@/lib/profile";

// POST /api/match  { action, a, b, userId, allow? }
export async function POST(req: NextRequest) {
  const { action, a, b, userId, allow } = await req.json();
  let m = a && b ? getMatch([a, b].sort().join("__")) ?? createCandidate(a, b) : undefined;
  if (!m) return NextResponse.json({ error: "match not found" }, { status: 404 });

  switch (action) {
    case "interest": m = expressInterest(m, userId); break;
    case "decline": m = decline(m); break;
    case "premeet": m = requirePreMeet(m); break;
    case "content_consent": m = setContentSharingConsent(m, userId, !!allow); break;
    default: return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  putMatch(m);

  // reveal only what the gate allows
  const other = userId === m.a ? m.b : m.a;
  const otherProfile = canSeeAvatar(m) ? getProfile(other) : undefined;
  return NextResponse.json({
    stage: m.stage,
    canChat: canChat(m),
    canShareRealMedia: canShareRealMedia(m),
    otherProfile: otherProfile ? publicView(otherProfile) : null,
  });
}
