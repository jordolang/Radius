import { NextRequest, NextResponse } from "next/server";
import { createPlan, cancelPlan, canCreatePlans, onPlanCreated } from "@/lib/planahead";
import { putPlan, getPlan, getReliability, setReliability } from "@/lib/store";

// POST /api/plan  { userId, cell, windowStart, windowEnd }
export async function POST(req: NextRequest) {
  const { userId, cell, windowStart, windowEnd } = await req.json();
  const rel = getReliability(userId);
  if (!canCreatePlans(rel))
    return NextResponse.json({ error: "plan-ahead locked (repeated misuse)" }, { status: 403 });
  if (/-?\d+\.\d{3,}/.test(cell))
    return NextResponse.json({ error: "cell must be coarse, not raw coords" }, { status: 422 });
  try {
    const plan = createPlan(userId, cell, windowStart, windowEnd);
    const key = `${userId}:${plan.createdAt}`;
    putPlan(key, plan);
    setReliability(onPlanCreated(rel));
    return NextResponse.json({ ok: true, key, status: plan.status });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 422 });
  }
}

// DELETE /api/plan  { key }  -> cancel (always free)
export async function DELETE(req: NextRequest) {
  const { key } = await req.json();
  const plan = getPlan(key);
  if (!plan) return NextResponse.json({ error: "plan not found" }, { status: 404 });
  putPlan(key, cancelPlan(plan));
  return NextResponse.json({ ok: true });
}
