/**
 * types.ts — Domain model for the proximity-availability app.
 *
 * Design commitments encoded here:
 *  - No raw coordinates anywhere; only coarse GeoCell.
 *  - No real photos in the profile; one stylized, non-identifiable avatar.
 *  - Nothing reveals between two users until BOTH explicitly opt in.
 *  - Safety reports are PRIVATE signal to moderation, never shown on a profile.
 *  - The pre-meet call is LIVE and NEVER recorded; we store only that it happened.
 */

import type { GeoCell } from "./geo";

export type UserId = string;

export interface User {
  id: UserId;
  ageVerified: boolean; // checked at signup; verification media is NOT retained
  avatarUrl: string; // stylized illustration generated once; not a real photo
  displayName: string; // chosen handle, not legal name
  bio?: string; // short, optional
  createdAt: number;
}

/**
 * Presence = "I'm available right now." Auto-expires so no one silently
 * broadcasts forever. Stores only the coarse cell.
 */
export interface Presence {
  userId: UserId;
  cell: GeoCell;
  expiresAt: number; // epoch ms; presence is ignored once expired
  updatedAt: number;
}

export type MatchStage =
  | "candidate" // both available & in proximity; neither has revealed
  | "mutual_interest" // both tapped "interested" -> chat + avatar unlock
  | "premeet_required" // chat open; live call must happen before meeting
  | "ready_to_meet" // both confirmed after the live call
  | "closed"; // expired, declined, or ended

export interface Match {
  id: string;
  a: UserId;
  b: UserId;
  stage: MatchStage;
  interested: Record<UserId, boolean>; // chat unlocks only when both true
  contentSharingConsent: Record<UserId, boolean>; // real photos/video gated per-user, revocable
  archived?: boolean; // user tucked it away in Discover → Archive; never deletes data
  createdAt: number;
  updatedAt: number;
}

/**
 * Live, NON-RECORDED pre-meet call. We persist only the fact that steps
 * occurred — never audio, video, transcript, or any sexual-consent artifact.
 */
export interface PreMeetCall {
  matchId: string;
  status: "required" | "in_progress" | "completed" | "declined";
  checklistAck: {
    publicPlaceAgreed: boolean;
    trustedContactShared: boolean;
    boundariesDiscussed: boolean;
  };
  confirmedProceed: Record<UserId, boolean>; // each confirms independently; either can cancel
  startedAt?: number;
  endedAt?: number;
}

export type SafetyReportCategory =
  | "no_show_or_misrepresented"
  | "ignored_boundaries"
  | "coercion_or_pressure" // severe
  | "threats_or_intimidation" // severe
  | "unwanted_contact_after"
  | "felt_unsafe_other";

export type ReportSeverity = "standard" | "severe";

export interface SafetyReport {
  id: string;
  reporterId: UserId; // stored for false-report tracking; NEVER shown to reported user
  reportedId: UserId;
  category: SafetyReportCategory;
  severity: ReportSeverity;
  note?: string; // optional, length-capped, screened
  createdAt: number;
}

export type TrustStatus = "active" | "throttled" | "suspended" | "banned";

export interface TrustState {
  userId: UserId;
  standardFlags: number;
  severeFlags: number;
  falseReportsFiled: number; // weaponizing the report system is itself a violation
  status: TrustStatus;
}

/**
 * Defensible record layer. Proves the platform walked users through safety
 * WITHOUT holding sensitive content. Booleans + timestamps + ToS version only.
 */
export interface ComplianceLog {
  matchId: string;
  termsVersionAccepted: string;
  preMeetCallCompleted: boolean;
  safetyChecklistAcknowledged: boolean;
  bothConfirmedProceed: boolean;
  timestamps: Record<string, number>;
  // Deliberately NO video, NO audio, NO transcript, NO consent recording.
}
