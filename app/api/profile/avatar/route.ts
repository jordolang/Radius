import { NextRequest, NextResponse } from "next/server";
import { avatarize, type EyeBox } from "@/lib/avatarize";

// POST /api/profile/avatar  { imageBase64, eyeBox }
// De-identifies the photo (cartoonize + pixelate eyes + mask) and strips EXIF.
// Returns a data URL for the avatar. In production, write to object storage.
export async function POST(req: NextRequest) {
  const { imageBase64, eyeBox } = (await req.json()) as { imageBase64: string; eyeBox: EyeBox };
  if (!imageBase64 || !eyeBox) {
    return NextResponse.json({ error: "imageBase64 and eyeBox required" }, { status: 400 });
  }
  const input = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ""), "base64");
  const out = await avatarize(input, eyeBox);
  return NextResponse.json({ avatarUrl: `data:image/png;base64,${out.toString("base64")}` });
}
