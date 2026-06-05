import { NextRequest, NextResponse } from "next/server";
import { detectAlerts, type BeaconPresence } from "@/lib/beacon";
import {
  presenceStore, getModes, setMode, getBeaconLog, setBeaconLog,
  blockedPairKeys, suspendedSet, compatibleSet,
} from "@/lib/db/repo";
import { getUserId, getUserIdEnsured } from "@/lib/auth";

// POST /api/beacon  { mode }  -> set passive/beacon for the signed-in user
export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const { mode } = await req.json();
  if (mode !== "passive" && mode !== "beacon")
    return NextResponse.json({ error: "mode must be passive|beacon" }, { status: 400 });
  await setMode(userId, mode);
  return NextResponse.json({ ok: true });
}

// GET /api/beacon  -> any immediate proximity alerts for the signed-in user
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const me = await presenceStore.get(userId);
  if (!me) return NextResponse.json({ alerts: [] });

  const others = (await presenceStore.all()).filter((p) => p.userId !== userId);
  const otherIds = others.map((p) => p.userId);

  // Prefetch everything detectAlerts needs synchronously, in bulk.
  const [modes, blocks, suspended, compatible] = await Promise.all([
    getModes([userId, ...otherIds]),
    blockedPairKeys(),
    suspendedSet([userId, ...otherIds]),
    compatibleSet(userId, otherIds),
  ]);

  const subject: BeaconPresence = { ...me, mode: modes.get(userId) ?? "passive" };
  const othersWithMode: BeaconPresence[] = others.map((p) => ({ ...p, mode: modes.get(p.userId) ?? "passive" }));

  // blocks are stored sorted-joined with "|" (distinct from the "__" match-id namespace)
  const blockKey = (a: string, b: string) => [a, b].sort().join("|");
  const { alerts, log } = detectAlerts(subject, othersWithMode, await getBeaconLog(), {
    isBlocked: (a, b) => blocks.has(blockKey(a, b)),
    isSuspended: (id) => suspended.has(id),
    isCompatible: (_a, b) => compatible.has(b),
  });
  await setBeaconLog(log);
  return NextResponse.json({ alerts: alerts.filter((a) => a.toUserId === userId) });
}
