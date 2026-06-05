import { NextRequest, NextResponse } from "next/server";
import { pushSignal, getSignals } from "@/lib/db/repo";
import { getUserId } from "@/lib/auth";
import type { SignalMessage } from "@/lib/premeet-signaling";

/**
 * WebRTC signaling relay (SDP/ICE only — never media). DB-backed so it works
 * across serverless instances; swap for a realtime provider at scale. The callId
 * IS the match id ("a__b"), so only its two participants may relay through it.
 */
function inCall(userId: string, callId: string): boolean {
  return callId.split("__").includes(userId);
}

// POST /api/signaling { callId, msg }
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { callId, msg } = (await req.json()) as { callId: string; msg: SignalMessage };
  if (!callId || !inCall(userId, callId)) return NextResponse.json({ error: "not your call" }, { status: 403 });

  const seq = await pushSignal(callId, msg);
  return NextResponse.json({ ok: true, seq });
}

// GET /api/signaling?callId=&since=  -> messages after `since`
export async function GET(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const callId = req.nextUrl.searchParams.get("callId");
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);
  if (!callId || !inCall(userId, callId)) return NextResponse.json({ error: "not your call" }, { status: 403 });

  return NextResponse.json(await getSignals(callId, since));
}
