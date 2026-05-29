/**
 * avatarize.ts — Turn an uploaded photo into a stylized, masked avatar WITHOUT AI.
 *
 * Pipeline (all deterministic image processing via sharp/libvips):
 *   1. Strip ALL metadata. Phone photos carry EXIF GPS + device ids; keeping
 *      them would defeat the entire location-privacy model. sharp drops metadata
 *      by default (we never call .withMetadata()).
 *   2. Square-crop + downscale so fine identifying detail is lost.
 *   3. Cartoonize: median-filter the flat regions, lift saturation, and quantize
 *      to a small palette so it reads as an illustration, not a photograph.
 *   4. De-identify the eyes: heavily pixelate the eye band, THEN composite an
 *      opaque masquerade mask over it — so even if the mask graphic were removed,
 *      the pixels underneath are already destroyed.
 *
 * HONEST LIMITS (surface these in the product, don't hide them):
 *   - Stylization + an eye mask is a DETERRENT, not guaranteed anonymity. Humans
 *     and face-matchers can sometimes still recognize a stylized face, especially
 *     when combined with exact height/weight/hair/skin/lifestyle + a 5-mile area.
 *   - The eye region must come from a face/eye DETECTOR or the user dragging the
 *     mask into place. This module takes the eye box as input and does not itself
 *     locate faces.
 *   - The strongest privacy comes from LOW detail. The more granular the rest of
 *     the profile, the less any photo treatment protects the person (see profile.ts).
 */

import sharp from "sharp";

export interface EyeBox {
  x: number; // px in the (pre-resize) source image
  y: number;
  width: number;
  height: number;
}

export interface AvatarizeOptions {
  outputSize?: number; // final square size, default 512
  paletteColors?: number; // cartoon flatness, default 24
  saturation?: number; // >1 = more illustrated, default 1.25
}

function masqueradeMaskSvg(w: number, h: number): Buffer {
  // A simple, tasteful opaque mask covering the eye band.
  const cx = w / 2;
  const eyeR = h * 0.32;
  return Buffer.from(`
    <svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#1a0f0a"/>
          <stop offset="100%" stop-color="#3a1f14"/>
        </linearGradient>
      </defs>
      <path d="M0,${h * 0.5}
               Q${cx},${-h * 0.1} ${w},${h * 0.5}
               Q${w},${h * 1.1} ${cx},${h * 0.95}
               Q0,${h * 1.1} 0,${h * 0.5} Z"
            fill="url(#g)"/>
      <circle cx="${w * 0.32}" cy="${h * 0.5}" r="${eyeR}" fill="#0c0706"/>
      <circle cx="${w * 0.68}" cy="${h * 0.5}" r="${eyeR}" fill="#0c0706"/>
      <path d="M0,${h * 0.5} Q${cx},${-h * 0.1} ${w},${h * 0.5}"
            fill="none" stroke="#d6713f" stroke-width="${Math.max(2, h * 0.03)}"/>
    </svg>`);
}

/**
 * Produce a de-identified avatar PNG buffer from a source image buffer.
 * `eyeBox` is in source-image pixel coordinates.
 */
export async function avatarize(
  input: Buffer,
  eyeBox: EyeBox,
  opts: AvatarizeOptions = {},
): Promise<Buffer> {
  const size = opts.outputSize ?? 512;
  const colors = opts.paletteColors ?? 24;
  const saturation = opts.saturation ?? 1.25;

  const meta = await sharp(input).metadata();
  const srcW = meta.width ?? size;
  const srcH = meta.height ?? size;

  // map the eye box into the square-cropped+resized output space
  const crop = Math.min(srcW, srcH);
  const offsetX = (srcW - crop) / 2;
  const offsetY = (srcH - crop) / 2;
  const scale = size / crop;
  const eb = {
    left: Math.max(0, Math.round((eyeBox.x - offsetX) * scale)),
    top: Math.max(0, Math.round((eyeBox.y - offsetY) * scale)),
    width: Math.min(size, Math.round(eyeBox.width * scale)),
    height: Math.min(size, Math.round(eyeBox.height * scale)),
  };

  // 1+2+3: strip metadata (default), square crop, downscale, cartoonize
  const base = await sharp(input)
    .resize(size, size, { fit: "cover", position: "attention" })
    .median(5) // smooth into flat, illustration-like regions
    .modulate({ saturation })
    .png({ colors, palette: true }) // quantize palette -> cartoon flatness
    .toBuffer();

  // 4a: destroy the eyes underneath — pixelate the band, then place back
  let composited = sharp(base);
  if (eb.width > 4 && eb.height > 4) {
    const blockW = Math.max(4, Math.round(eb.width / 6));
    const blockH = Math.max(4, Math.round(eb.height / 4));
    const pixelatedEyes = await sharp(base)
      .extract({ left: eb.left, top: eb.top, width: eb.width, height: eb.height })
      .resize(blockW, blockH, { kernel: "nearest" })
      .resize(eb.width, eb.height, { kernel: "nearest" }) // blow back up = mosaic
      .toBuffer();
    composited = sharp(
      await composited
        .composite([{ input: pixelatedEyes, left: eb.left, top: eb.top }])
        .toBuffer(),
    );
  }

  // 4b: opaque masquerade mask on top
  const mask = masqueradeMaskSvg(size, Math.round(size * 0.42));
  const maskTop = Math.max(0, eb.top - Math.round(size * 0.06));
  return composited
    .composite([{ input: mask, left: 0, top: maskTop }])
    .png()
    .toBuffer();
}
