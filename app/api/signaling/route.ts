import { NextRequest, NextResponse } from "next/server";
import type { SignalMessage } from "@/lib/premeet-signaling";

// Dev-only signaling relay via in-memory mailbox + polling.
// PRODUCTION: replace with a realtime provider (Ably / Pusher / Supabase
// Realtime) or a dedicated WebSocket server. Vercel functions can't hold a
// socket open. The server only relays SDP/ICE; it never sees media.
const mailbox = new Map<string, { seq: number; msg: SignalMessage }[]>();
let seq = 0;

// POST /api/signaling { callId, msg }
export async function POST(req: NextRequest) {
  const { callId, msg } = (await req.json()) as { callId: string; msg: SignalMessage };
  const box = mailbox.get(callId) ?? [];
  box.push({ seq: ++seq, msg });
  mailbox.set(callId, box);
  return NextResponse.json({ ok: true, seq });
}

// GET /api/signaling?callId=&since=  -> messages after `since`
export async function GET(req: NextRequest) {
  const callId = req.nextUrl.searchParams.get("callId")!;
  const since = Number(req.nextUrl.searchParams.get("since") ?? 0);
  const box = (mailbox.get(callId) ?? []).filter((m) => m.seq > since);
  const last = box.length ? box[box.length - 1].seq : since;
  return NextResponse.json({ messages: box.map((m) => m.msg), last });
}
