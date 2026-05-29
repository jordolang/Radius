import { NextRequest, NextResponse } from "next/server";
import { detectAlerts, type BeaconPresence } from "@/lib/beacon";
import { presenceStore, getMode, setMode, getBeaconLog, setBeaconLog, isBlocked, getTrust } from "@/lib/store";

// POST /api/beacon  { userId, mode }  -> set passive/beacon
export async function POST(req: NextRequest) {
  const { userId, mode } = await req.json();
  if (mode !== "passive" && mode !== "beacon")
    return NextResponse.json({ error: "mode must be passive|beacon" }, { status: 400 });
  setMode(userId, mode);
  return NextResponse.json({ ok: true });
}

// GET /api/beacon?userId=  -> any immediate alerts for this user
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const me = await presenceStore.get(userId);
  if (!me) return NextResponse.json({ alerts: [] });

  const subject: BeaconPresence = { ...me, mode: getMode(userId) };
  const others: BeaconPresence[] = (await presenceStore.all())
    .filter((p) => p.userId !== userId)
    .map((p) => ({ ...p, mode: getMode(p.userId) }));

  const { alerts, log } = detectAlerts(subject, others, getBeaconLog(), {
    isBlocked,
    isSuspended: (id) => { const s = getTrust(id).status; return s === "suspended" || s === "banned"; },
  });
  setBeaconLog(log);
  return NextResponse.json({ alerts: alerts.filter((a) => a.toUserId === userId) });
}
