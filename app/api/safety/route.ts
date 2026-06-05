import { NextRequest, NextResponse } from "next/server";
import { applyReport, severityFor } from "@/lib/safety";
import { addReport, getTrust, setTrust, ensureUser } from "@/lib/db/repo";
import { getUserIdEnsured } from "@/lib/auth";
import type { SafetyReport } from "@/lib/types";

// POST /api/safety  { reportedId, category, note? }  (reporter is the session user)
export async function POST(req: NextRequest) {
  const reporterId = await getUserIdEnsured();
  if (!reporterId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { reportedId, category, note } = await req.json();
  if (!reportedId || !category) {
    return NextResponse.json({ error: "reportedId and category required" }, { status: 400 });
  }

  const report: SafetyReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reporterId, reportedId, category,
    severity: severityFor(category),
    note: typeof note === "string" ? note.slice(0, 1000) : undefined,
    createdAt: Date.now(),
  };

  await ensureUser(reportedId);
  await addReport(report);
  const { state, queueForReview } = applyReport(await getTrust(reportedId), report);
  await setTrust(state);
  // never reveal the reported user's status to the reporter
  return NextResponse.json({ ok: true, queuedForReview: queueForReview });
}
