import { NextRequest, NextResponse } from "next/server";
import { offerAliases, claimAlias } from "@/lib/identity";
import { aliasesInUse } from "@/lib/db/repo";
import { getUserId } from "@/lib/auth";

// GET /api/identity -> 10 alias choices for the signed-in user
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  const offer = offerAliases(userId, await aliasesInUse());
  return NextResponse.json(offer);
}

// POST /api/identity  { choices, pick }
export async function POST(req: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const { choices, pick } = await req.json();
  // Uniqueness is ultimately enforced by the profiles.alias unique constraint;
  // here we validate the pick against the live set of aliases already in use.
  const res = claimAlias({ userId, choices, createdAt: Date.now() }, pick, await aliasesInUse());
  if (!res.ok) return NextResponse.json({ error: res.reason }, { status: 409 });
  return NextResponse.json({ ok: true, alias: res.alias });
}
