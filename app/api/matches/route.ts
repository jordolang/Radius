import { NextResponse } from "next/server";
import { getMatchesForUser, getProfile } from "@/lib/db/repo";
import { canChat, canSeeAvatar } from "@/lib/match";
import { getUserId } from "@/lib/auth";
import type { Match } from "@/lib/types";

/**
 * GET /api/matches — every match the signed-in user is part of, as privacy-safe
 * summaries for the Discover hub. The other person's alias + cartoon avatar are
 * included ONLY once the pair has reached mutual interest (same gate as the chat
 * and the match view). Before that, the entry is an anonymous "pending spark".
 */
export interface MatchSummary {
  matchId: string;
  stage: Match["stage"];
  archived: boolean;
  updatedAt: number;
  youInterested: boolean;
  canChat: boolean;
  revealed: boolean;
  other: { alias: string; avatarUrl: string } | null;
}

export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const matches = await getMatchesForUser(userId);

  const summaries: MatchSummary[] = await Promise.all(
    matches.map(async (m) => {
      const otherId = userId === m.a ? m.b : m.a;
      const revealed = canSeeAvatar(m);
      let other: MatchSummary["other"] = null;
      if (revealed) {
        const op = await getProfile(otherId);
        if (op) other = { alias: op.alias, avatarUrl: op.avatarUrl };
      }
      return {
        matchId: m.id,
        stage: m.stage,
        archived: Boolean(m.archived),
        updatedAt: m.updatedAt,
        youInterested: Boolean(m.interested[userId]),
        canChat: canChat(m),
        revealed,
        other,
      };
    }),
  );

  return NextResponse.json({ matches: summaries });
}
