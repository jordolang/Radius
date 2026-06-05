"use client";

/**
 * LeafletCanvas — the token-free fallback rendering of the home map.
 *
 * Used when NEXT_PUBLIC_MAPBOX_TOKEN is absent so the app still runs out of the
 * box. Same privacy contract as MapboxCanvas: the dot is the device's on-device
 * raw location; the shaded rectangle is the exact coarse cell others can infer;
 * the dashed ring is the proximity reach. No other user is ever plotted.
 */

import "leaflet/dist/leaflet.css";
import { useEffect, useRef } from "react";
import type { Circle, Map as LeafletMap, Marker, Rectangle } from "leaflet";
import { cellBounds, cellCenter, toCoarseCell, type LatLng } from "@/lib/geo";
import type { MapCanvasProps } from "./mapbox-canvas";

const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const PROXIMITY_M = 5 * 1.6 * 1609.34;
const EMBER = "#e8915b";

function dotIcon(L: typeof import("leaflet"), available: boolean, nearby: boolean) {
  const cls = `radius-dot${available ? " is-on" : ""}${available && nearby ? " is-near" : ""}`;
  return L.divIcon({
    className: "radius-dot-wrap",
    html: `<span class="${cls}"><span class="radius-dot-core"></span></span>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

export function LeafletCanvas({ coords, available, nearby }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const cellRef = useRef<Rectangle | null>(null);
  const reachRef = useRef<Circle | null>(null);
  const LRef = useRef<typeof import("leaflet") | null>(null);
  const centeredRef = useRef(false);

  useEffect(() => {
    let disposed = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current || mapRef.current) return;
      LRef.current = L;
      const map = L.map(containerRef.current, {
        center: DEFAULT_CENTER,
        zoom: 12,
        zoomControl: false,
        attributionControl: false,
      });
      L.tileLayer(DARK_TILES, { subdomains: "abcd", maxZoom: 19 }).addTo(map);
      // No on-screen zoom buttons — this is a native iOS surface; pinch-to-zoom is expected.
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 150);
    })();
    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const L = LRef.current;
    const map = mapRef.current;
    if (!L || !map || !coords) return;

    const center: [number, number] = [coords.lat, coords.lng];
    const cell = toCoarseCell(coords.lat, coords.lng);
    const b = cellBounds(cell);
    const rect: [[number, number], [number, number]] = [
      [b.south, b.west],
      [b.north, b.east],
    ];
    const cc = cellCenter(cell);

    if (!markerRef.current) {
      markerRef.current = L.marker(center, { icon: dotIcon(L, available, nearby), interactive: false }).addTo(map);
    } else {
      markerRef.current.setLatLng(center);
      markerRef.current.setIcon(dotIcon(L, available, nearby));
    }

    if (!reachRef.current) {
      reachRef.current = L.circle([cc.lat, cc.lng], {
        radius: PROXIMITY_M,
        color: "rgba(255,255,255,0.25)",
        weight: 1,
        dashArray: "2 6",
        fill: false,
      }).addTo(map);
    } else {
      reachRef.current.setLatLng([cc.lat, cc.lng]);
    }

    if (!cellRef.current) {
      cellRef.current = L.rectangle(rect).addTo(map);
    } else {
      cellRef.current.setBounds(rect);
    }
    cellRef.current.setStyle({
      color: available ? EMBER : "rgba(255,255,255,0.35)",
      weight: 1.5,
      fillColor: EMBER,
      fillOpacity: available ? 0.12 : 0.04,
    });

    if (!centeredRef.current) {
      map.setView(center, 12, { animate: true });
      centeredRef.current = true;
    }
  }, [coords, available, nearby]);

  return <div ref={containerRef} className="absolute inset-0" style={{ background: "var(--surface-2)" }} />;
}
