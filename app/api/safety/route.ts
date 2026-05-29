import { NextRequest, NextResponse } from "next/server";
import { applyReport, severityFor } from "@/lib/safety";
import { addReport, getTrust, setTrust } from "@/lib/store";
import type { SafetyReport } from "@/lib/types";

// POST /api/safety  { reporterId, reportedId, category, note? }
export async function POST(req: NextRequest) {
  const { reporterId, reportedId, category, note } = await req.json();
  const report: SafetyReport = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    reporterId, reportedId, category,
    severity: severityFor(category),
    note: typeof note === "string" ? note.slice(0, 1000) : undefined,
    createdAt: Date.now(),
  };
  addReport(report);
  const { state, queueForReview } = applyReport(getTrust(reportedId), report);
  setTrust(state);
  // never reveal the reported user's status to the reporter
  return NextResponse.json({ ok: true, queuedForReview: queueForReview });
}
