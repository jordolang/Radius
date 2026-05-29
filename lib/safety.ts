/**
 * safety.ts — Private structured safety reports + graduated enforcement.
 *
 * Hard rules:
 *  - Reports are PRIVATE moderation signal. They are never shown on a profile
 *    and never surfaced to the reported user. No public "score" exists.
 *  - A single standard report cannot ban anyone (that would make the report a
 *    coercion weapon). Standard flags AGGREGATE into graduated limits.
 *  - Severe categories (threats / coercion) fast-track to interim suspension +
 *    review, rather than waiting for a threshold.
 *  - Filing false reports is itself tracked and penalized, so the system can't
 *    be weaponized against the people it protects.
 */

import type {
  ReportSeverity,
  SafetyReport,
  SafetyReportCategory,
  TrustState,
  UserId,
} from "./types";

const SEVERE: ReadonlySet<SafetyReportCategory> = new Set([
  "coercion_or_pressure",
  "threats_or_intimidation",
]);

const STANDARD_THROTTLE_AT = 3;
const STANDARD_SUSPEND_AT = 5;

export function severityFor(category: SafetyReportCategory): ReportSeverity {
  return SEVERE.has(category) ? "severe" : "standard";
}

export function emptyTrustState(userId: UserId): TrustState {
  return {
    userId,
    standardFlags: 0,
    severeFlags: 0,
    falseReportsFiled: 0,
    status: "active",
  };
}

/**
 * Apply a report to the reported user's trust state.
 * Returns the new state plus whether a human review should be queued.
 */
export function applyReport(
  state: TrustState,
  report: SafetyReport,
): { state: TrustState; queueForReview: boolean } {
  if (report.severity === "severe") {
    const next: TrustState = {
      ...state,
      severeFlags: state.severeFlags + 1,
      // interim, reversible suspension — never silent, never public, pending review
      status: state.status === "banned" ? "banned" : "suspended",
    };
    return { state: next, queueForReview: true };
  }

  const standardFlags = state.standardFlags + 1;
  let status: TrustState["status"] = state.status;
  if (status === "active" || status === "throttled") {
    if (standardFlags >= STANDARD_SUSPEND_AT) status = "suspended";
    else if (standardFlags >= STANDARD_THROTTLE_AT) status = "throttled";
  }
  return {
    state: { ...state, standardFlags, status },
    queueForReview: status === "suspended",
  };
}

/** Reviewer outcome after looking at a severe report or a suspension. */
export function resolveReview(
  state: TrustState,
  outcome: "ban" | "reinstate" | "uphold_suspension",
): TrustState {
  switch (outcome) {
    case "ban":
      return { ...state, status: "banned" };
    case "reinstate":
      return { ...state, status: "active" };
    case "uphold_suspension":
      return { ...state, status: "suspended" };
  }
}

/** Mark that a reporter filed a report later judged false/malicious. */
export function recordFalseReport(reporter: TrustState): TrustState {
  const falseReportsFiled = reporter.falseReportsFiled + 1;
  // weaponizing the safety system gets the SAME graduated treatment
  let status = reporter.status;
  if (status === "active" && falseReportsFiled >= STANDARD_THROTTLE_AT) {
    status = "throttled";
  }
  if (falseReportsFiled >= STANDARD_SUSPEND_AT) status = "suspended";
  return { ...reporter, falseReportsFiled, status };
}

export function canMatch(state: TrustState): boolean {
  return state.status === "active" || state.status === "throttled";
}

/** Throttled users still match but at a reduced rate (anti-spam / cooling off). */
export function matchRateLimitPerHour(state: TrustState): number {
  if (state.status === "throttled") return 3;
  if (state.status === "active") return 30;
  return 0;
}
