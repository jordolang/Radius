import { NextRequest, NextResponse } from "next/server";
import { createPlan, cancelPlan, canCreatePlans, onPlanCreated } from "@/lib/planahead";
import { putPlan, getPlan, getReliability, setReliability } from "@/lib/db/repo";
import { getUserIdEnsured } from "@/lib/auth";

// POST /api/plan  { cell, windowStart, windowEnd }  (identity from session)
export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { cell, windowStart, windowEnd } = await req.json();
  const rel = await getReliability(userId);
  if (!canCreatePlans(rel))
    return NextResponse.json({ error: "plan-ahead locked (repeated misuse)" }, { status: 403 });
  if (typeof cell !== "string" || /-?\d+\.\d{3,}/.test(cell))
    return NextResponse.json({ error: "cell must be coarse, not raw coords" }, { status: 422 });

  try {
    const plan = createPlan(userId, cell, windowStart, windowEnd);
    const key = await putPlan(plan);
    await setReliability(onPlanCreated(rel));
    return NextResponse.json({ ok: true, key, status: plan.status });
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
