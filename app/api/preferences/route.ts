import { NextRequest, NextResponse } from "next/server";
import { sanitizeCategoricalPreferences, validatePreferences, type Preferences } from "@/lib/preferences";
import { getPreferences, putPreferences } from "@/lib/db/repo";
import { getUserId, getUserIdEnsured } from "@/lib/auth";

// GET /api/preferences  -> the signed-in user's absolutes (or null)
export async function GET() {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });
  return NextResponse.json({ preferences: (await getPreferences(userId)) ?? null });
}

// POST /api/preferences  (absolutes JSON; identity from session)
export async function POST(req: NextRequest) {
  const userId = await getUserIdEnsured();
  if (!userId) return NextResponse.json({ error: "sign in required" }, { status: 401 });

  const body = (await req.json()) as Partial<Preferences>;
  const v = validatePreferences(body);
  if (!v.ok) return NextResponse.json({ errors: v.errors }, { status: 422 });

  await putPreferences({
    userId,
    ageMin: Number(body.ageMin), ageMax: Number(body.ageMax),
    heightMinIn: Number(body.heightMinIn), heightMaxIn: Number(body.heightMaxIn),
    weightMinLbs: Number(body.weightMinLbs), weightMaxLbs: Number(body.weightMaxLbs),
    ...sanitizeCategoricalPreferences(body),
    createdAt: Date.now(),
  });
  return NextResponse.json({ ok: true });
}
