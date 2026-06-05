/**
 * zip.ts — Coarse ZIP-code → area resolution for Plan Ahead.
 *
 * The app NEVER uses an exact address. A user enters a ZIP, we resolve it to the
 * ZIP's approximate centroid, and that point is immediately quantized to the same
 * ~5-mile coarse cell everything else uses (see geo.ts). We keep only the city +
 * state label for display ("Ann Arbor, MI"), never a street or precise point.
 *
 * Geocoding uses the keyless Zippopotam.us service. Server-only.
 */

import "server-only";
import { toCoarseCell, type GeoCell } from "./geo";

export interface ZipArea {
  zip: string;
  cell: GeoCell; // coarse ~5-mile cell — the only location we keep
  label: string; // "City, ST" for display
}

/** Resolve a US ZIP to a coarse cell + city label, or null if unknown/invalid. */
export async function resolveZip(zip: string): Promise<ZipArea | null> {
  if (!/^\d{5}$/.test(zip)) return null;
  try {
    const r = await fetch(`https://api.zippopotam.us/us/${zip}`, { cache: "force-cache" });
    if (!r.ok) return null;
    const data = (await r.json()) as {
      places?: { latitude: string; longitude: string; "place name": string; "state abbreviation": string }[];
    };
    const place = data.places?.[0];
    if (!place) return null;
    const lat = Number(place.latitude);
    const lng = Number(place.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return {
      zip,
      cell: toCoarseCell(lat, lng), // coarsen immediately; raw centroid is dropped
      label: `${place["place name"]}, ${place["state abbreviation"]}`,
    };
  } catch {
    return null;
  }
}
