import { NextRequest, NextResponse } from "next/server";
import { offerAliases, claimAlias } from "@/lib/identity";
import { aliasTaken, claimAliasInUse } from "@/lib/store";

// GET /api/identity?userId= -> 10 alias choices
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });
  const offer = offerAliases(userId, aliasTaken());
  return NextResponse.json(offer);
}

// POST /api/identity  { userId, choices, pick }
export async function POST(req: NextRequest) {
  const { userId, choices, pick } = await req.json();
  const res = claimAlias({ userId, choices, createdAt: Date.now() }, pick, aliasTaken());
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 409 });
  claimAliasInUse(res.alias);
  return NextResponse.json({ ok: true, alias: res.alias });
}
