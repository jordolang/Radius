import { NextRequest, NextResponse } from "next/server";
import {
  createPlan, cancelPlan, canCreatePlans, onPlanCreated, isPlanLeadHours, leadPhrase,
} from "@/lib/planahead";
import { putPlan, getPlan, getReliability, setReliability } from "@/lib/db/repo";
import { resolveZip } from "@/lib/zip";
import { getUserIdEnsured } from "@/lib/auth";

// POST /api/plan
//   Preferred: { zip, leadHours }  -> broadcast from the ZIP's coarse area for the
//   window [now, now+leadHours]. No exact address is ever used.
//   Legacy:    { cell, windowStart, windowEnd }
export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const body = await req.json();
  const rel = await getReliability(userId);
  if (!canCreatePlans(rel))
    return NextResponse.json({ error: "plan-ahead locked (repeated misuse)" }, { status: 403 });

  // Resolve the request into a coarse cell + window, by either path.
  let cell: string;
  let windowStart: number;
  let windowEnd: number;
  let label: string | undefined;
  let phrase: string | undefined;

  if (typeof body.zip === "string" || typeof body.leadHours === "number") {
    if (!isPlanLeadHours(body.leadHours))
      return NextResponse.json({ error: "leadHours must be one of 2, 4, 8, 12, 24" }, { status: 422 });
    const area = await resolveZip(String(body.zip ?? ""));
    if (!area) return NextResponse.json({ error: "couldn't find that ZIP code" }, { status: 422 });
    cell = area.cell;
    label = area.label;
    phrase = leadPhrase(body.leadHours);
    windowStart = Date.now();
    windowEnd = windowStart + body.leadHours * 3_600_000;
  } else {
    ({ cell, windowStart, windowEnd } = body);
    if (typeof cell !== "string" || /-?\d+\.\d{3,}/.test(cell))
      return NextResponse.json({ error: "cell must be coarse, not raw coords" }, { status: 422 });
  }

  try {
    const plan = createPlan(userId, cell, windowStart, windowEnd);
    const key = await putPlan(plan);
    await setReliability(onPlanCreated(rel));
    return NextResponse.json({ ok: true, key, status: plan.status, label, phrase, windowEnd });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// DELETE /api/plan  { key }  -> cancel (always free). Only your own plans.
export async function DELETE(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { key } = await req.json();
  if (typeof key !== "string" || key.split(":")[0] !== userId)
    return NextResponse.json({ error: "not your plan" }, { status: 403 });

  const plan = await getPlan(key);
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
  await putPlan(cancelPlan(plan));
  return NextResponse.json({ ok: true });
}
