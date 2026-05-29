/**
 * geo.ts — Coarse geolocation core.
 *
 * Privacy contract for this module (do not break it):
 *   1. A raw {lat,lng} enters `toCoarseCell()` and is IMMEDIATELY quantized to a
 *      ~5-mile grid cell. The raw point is never returned, never logged, never stored.
 *   2. Everything downstream (presence, matching, alerts) operates ONLY on the opaque
 *      coarse cell id. A cell is ~5 miles across, which is far too coarse to identify
 *      a home or workplace — that fuzz IS the safety feature, not a bug.
 *   3. Proximity is computed from quantized CELL CENTERS, never from the original
 *      coordinates. Match resolution is therefore intentionally limited to grid size.
 *
 * If you ever find yourself wanting to store the raw lat/lng "just for accuracy",
 * stop — that is the exact mistake this module exists to prevent.
 */

const MILES_PER_DEG_LAT = 69.0; // close enough for a coarse privacy grid
const DEFAULT_CELL_MILES = 5;

export type GeoCell = string; // opaque "<latIdx>:<lngIdx>:<cellMiles>"

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Quantize a precise coordinate to a coarse grid cell.
 * The longitude cell size is derived from the *band's* reference latitude (not the
 * raw latitude) so that two nearby users always land on a consistent longitude grid.
 */
export function toCoarseCell(
  lat: number,
  lng: number,
  cellMiles: number = DEFAULT_CELL_MILES,
): GeoCell {
  const latCellDeg = cellMiles / MILES_PER_DEG_LAT;
  const latIdx = Math.floor(lat / latCellDeg);

  const refLat = (latIdx + 0.5) * latCellDeg; // center latitude of this band
  const milesPerDegLng = Math.max(
    MILES_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180),
    1e-6,
  );
  const lngCellDeg = cellMiles / milesPerDegLng;
  const lngIdx = Math.floor(lng / lngCellDeg);

  return `${latIdx}:${lngIdx}:${cellMiles}`;
}

/** Approximate center of a coarse cell. Resolution is the cell size by design. */
export function cellCenter(cell: GeoCell): LatLng {
  const [latIdxStr, lngIdxStr, cellMilesStr] = cell.split(":");
  const latIdx = Number(latIdxStr);
  const lngIdx = Number(lngIdxStr);
  const cellMiles = Number(cellMilesStr);

  const latCellDeg = cellMiles / MILES_PER_DEG_LAT;
  const centerLat = (latIdx + 0.5) * latCellDeg;

  const milesPerDegLng = Math.max(
    MILES_PER_DEG_LAT * Math.cos((centerLat * Math.PI) / 180),
    1e-6,
  );
  const lngCellDeg = cellMiles / milesPerDegLng;
  const centerLng = (lngIdx + 0.5) * lngCellDeg;

  return { lat: centerLat, lng: centerLng };
}

/** Great-circle distance in miles between two points. */
export function haversineMiles(a: LatLng, b: LatLng): number {
  const R = 3958.8;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Distance between the centers of two coarse cells, in miles. */
export function cellDistanceMiles(a: GeoCell, b: GeoCell): number {
  return haversineMiles(cellCenter(a), cellCenter(b));
}

/**
 * Whether two coarse cells are close enough to be candidate matches.
 * Threshold defaults a little above the cell size to be inclusive across the
 * quantization seam (two users ~5mi apart can fall in cells whose centers are
 * a bit further apart).
 */
export function inProximity(
  a: GeoCell,
  b: GeoCell,
  thresholdMiles: number = DEFAULT_CELL_MILES * 1.6,
): boolean {
  return cellDistanceMiles(a, b) <= thresholdMiles;
}
