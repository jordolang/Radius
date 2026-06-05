"use client";

/**
 * MapboxCanvas — the Mapbox GL JS rendering of the home map.
 *
 * PRIVACY (identical contract to the Leaflet canvas):
 *  - The pulsing dot uses the device's raw {lat,lng}, which exists ONLY in
 *    client state and is rendered on-device. It is never sent anywhere.
 *  - The shaded rectangle is the EXACT coarse ~5-mile cell (from lib/geo) that
 *    others can infer while you're available — the honest "what is shared".
 *  - The faint outer ring is the proximity reach, so you understand how far a
 *    match can be. It is centered on YOUR area, carries no directional info.
 *  - No other user is ever plotted. `nearby` only animates a halo on your own
 *    dot; it reflects the anonymous boolean from /api/alert, never a position.
 */

import "mapbox-gl/dist/mapbox-gl.css";
import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import { cellBounds, cellCenter, toCoarseCell, type LatLng } from "@/lib/geo";

const DEFAULT_CENTER: [number, number] = [-122.4194, 37.7749]; // [lng,lat] until located
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
const PROXIMITY_MILES = 5 * 1.6; // matches inProximity() default threshold
const EMBER = "#e8915b";

const CELL_SOURCE = "radius-cell";
const REACH_SOURCE = "radius-reach";

export interface MapCanvasProps {
  coords: LatLng | null;
  available: boolean;
  nearby: boolean;
}

/** A closed ring (GeoJSON polygon) approximating a circle of `radiusMiles`. */
function circlePolygon(center: LatLng, radiusMiles: number, steps = 72): number[][] {
  const latDeg = radiusMiles / 69.0;
  const lngDeg = radiusMiles / Math.max(69.0 * Math.cos((center.lat * Math.PI) / 180), 1e-6);
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    ring.push([center.lng + lngDeg * Math.cos(theta), center.lat + latDeg * Math.sin(theta)]);
  }
  return ring;
}

function cellRectangle(cell: string): number[][] {
  const b = cellBounds(cell);
  return [
    [b.west, b.south],
    [b.east, b.south],
    [b.east, b.north],
    [b.west, b.north],
    [b.west, b.south],
  ];
}

/** A stable marker element; classes are toggled in place so Mapbox keeps tracking it. */
function makeDot(): { wrap: HTMLElement; dot: HTMLElement } {
  const wrap = document.createElement("div");
  wrap.className = "radius-dot-wrap";
  const dot = document.createElement("span");
  dot.className = "radius-dot";
  const core = document.createElement("span");
  core.className = "radius-dot-core";
  dot.appendChild(core);
  wrap.appendChild(dot);
  return { wrap, dot };
}

function styleDot(dot: HTMLElement, available: boolean, nearby: boolean): void {
  dot.classList.toggle("is-on", available);
  dot.classList.toggle("is-near", available && nearby);
}

export function MapboxCanvas({ coords, available, nearby }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const dotRef = useRef<HTMLElement | null>(null);
  const loadedRef = useRef(false);
  const centeredRef = useRef(false);

  // Initialize the map once.
  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token || !containerRef.current || mapRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: DARK_STYLE,
      center: DEFAULT_CENTER,
      zoom: 11.5,
      attributionControl: false, // re-added compact below (Mapbox ToS requires attribution)
      pitchWithRotate: false,
      dragRotate: false,
    });
    map.addControl(new mapboxgl.AttributionControl({ compact: true }), "bottom-left");
    // No on-screen zoom/nav buttons — this is a native iOS surface; pinch-to-zoom is expected.
    mapRef.current = map;

    map.on("load", () => {
      // Proximity reach (faint outer ring) — drawn beneath the cell.
      map.addSource(REACH_SOURCE, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[]] }, properties: {} },
      });
      map.addLayer({
        id: `${REACH_SOURCE}-line`,
        type: "line",
        source: REACH_SOURCE,
        paint: { "line-color": "rgba(255,255,255,0.25)", "line-width": 1, "line-dasharray": [2, 3] },
      });

      // Your coarse cell — the exact area others can infer.
      map.addSource(CELL_SOURCE, {
        type: "geojson",
        data: { type: "Feature", geometry: { type: "Polygon", coordinates: [[]] }, properties: {} },
      });
      map.addLayer({
        id: `${CELL_SOURCE}-fill`,
        type: "fill",
        source: CELL_SOURCE,
        paint: { "fill-color": EMBER, "fill-opacity": 0.04 },
      });
      map.addLayer({
        id: `${CELL_SOURCE}-line`,
        type: "line",
        source: CELL_SOURCE,
        paint: { "line-color": "rgba(255,255,255,0.35)", "line-width": 1.5 },
      });

      loadedRef.current = true;
      // Force a redraw with whatever coords we already have.
      map.resize();
    });

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
      dotRef.current = null;
      loadedRef.current = false;
      centeredRef.current = false;
    };
  }, []);

  // Update marker, cell, reach ring, and styling as state resolves.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !coords) return;

    const apply = () => {
      if (!loadedRef.current) return;
      const lngLat: [number, number] = [coords.lng, coords.lat];

      if (!markerRef.current) {
        const { wrap, dot } = makeDot();
        dotRef.current = dot;
        markerRef.current = new mapboxgl.Marker({ element: wrap }).setLngLat(lngLat).addTo(map);
      } else {
        markerRef.current.setLngLat(lngLat);
      }
      if (dotRef.current) styleDot(dotRef.current, available, nearby);

      const cell = toCoarseCell(coords.lat, coords.lng);
      const center = cellCenter(cell);

      const cellSrc = map.getSource(CELL_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      cellSrc?.setData({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [cellRectangle(cell)] },
        properties: {},
      });
      map.setPaintProperty(`${CELL_SOURCE}-fill`, "fill-opacity", available ? 0.12 : 0.04);
      map.setPaintProperty(
        `${CELL_SOURCE}-line`,
        "line-color",
        available ? EMBER : "rgba(255,255,255,0.35)",
      );

      const reachSrc = map.getSource(REACH_SOURCE) as mapboxgl.GeoJSONSource | undefined;
      reachSrc?.setData({
        type: "Feature",
        geometry: { type: "Polygon", coordinates: [circlePolygon(center, PROXIMITY_MILES)] },
        properties: {},
      });

      if (!centeredRef.current) {
        map.easeTo({ center: lngLat, zoom: 11.5, duration: 600 });
        centeredRef.current = true;
      }
    };

    if (loadedRef.current) apply();
    else map.once("load", apply);
  }, [coords, available, nearby]);

  return <div ref={containerRef} className="absolute inset-0" style={{ background: "var(--surface-2)" }} />;
}
