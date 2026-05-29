import { NextRequest, NextResponse } from "next/server";
import { validateProfile, type Profile } from "@/lib/profile";
import { putProfile } from "@/lib/store";

// POST /api/profile  (full profile JSON; avatarUrl from /api/profile/avatar)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as Partial<Profile>;
  const v = validateProfile(body);
  if (!v.ok) return NextResponse.json({ errors: v.errors }, { status: 422 });
  const profile = { ...(body as Profile), createdAt: Date.now() };
  putProfile(profile);
  return NextResponse.json({ ok: true });
}
