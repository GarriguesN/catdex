"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getPocketBase } from "@/lib/pocketbase";

export interface MapMarkerData {
  id: string;
  catId: string;
  catName: string;
  thumbFieldName?: string;
  photoId: string;
  lat: number;
  lng: number;
  takenAt: number;
  /** Own capture (orange ring) vs a friend's (blue ring). */
  isOwn: boolean;
  /** Friend's display name — only set for friend captures. */
  ownerName?: string;
}

const OWN_RING = "#FF8A26"; // --color-catdex-orange
const FRIEND_RING = "#3B82F6"; // --color-catdex-blue
const MIXED_CLUSTER = "#A9A9A9"; // --color-catdex-gray-light

/** Circular photo pin — orange ring for own captures, blue for friends' (falls back to paw dot). */
function createCatIcon(thumbUrl: string | null, isOwn: boolean): L.DivIcon {
  const ring = isOwn ? OWN_RING : FRIEND_RING;
  return L.divIcon({
    className: "cat-marker",
    html: `<div style="
      width:44px;height:44px;border-radius:50%;
      border:3px solid #FFFFFF;
      box-shadow:0 0 0 2px ${ring}, 0 4px 10px rgba(34,35,38,0.25);
      overflow:hidden;background:#FFF7EF;
      ${thumbUrl ? `background-image:url(${thumbUrl});background-size:cover;background-position:center;` : ""}
      display:flex;align-items:center;justify-content:center;font-size:20px;
    ">${thumbUrl ? "" : "🐾"}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/** Circle with white count — cluster pin. Orange = own only, blue = friends
 * only, neutral gray when mixed so the color never lies about composition. */
function createClusterIcon(count: number, color: string): L.DivIcon {
  const size = count >= 10 ? 44 : 38;
  return L.divIcon({
    className: "cluster-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:${color};border:3px solid #FFFFFF;
      box-shadow:0 4px 10px rgba(34,35,38,0.25);
      display:flex;align-items:center;justify-content:center;
      color:#FFF;font-weight:700;font-size:15px;
      font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
    ">${count}</div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

type Cluster = { lat: number; lng: number; items: MapMarkerData[] };

/** Naive grid clustering — groups markers closer than ~70px at current zoom. */
function clusterize(markers: MapMarkerData[], zoom: number): Cluster[] {
  const cell = (360 / (256 * Math.pow(2, zoom))) * 70;
  const grid = new Map<string, Cluster>();
  for (const m of markers) {
    const key = `${Math.floor(m.lat / cell)}:${Math.floor(m.lng / cell)}`;
    const c = grid.get(key);
    if (c) {
      c.items.push(m);
      c.lat = (c.lat * (c.items.length - 1) + m.lat) / c.items.length;
      c.lng = (c.lng * (c.items.length - 1) + m.lng) / c.items.length;
    } else {
      grid.set(key, { lat: m.lat, lng: m.lng, items: [m] });
    }
  }
  return [...grid.values()];
}

const VIEW_STORAGE_KEY = "catdex:map-view";

/**
 * Keeps Leaflet's internal size in sync with the container. On mobile the
 * 100dvh container resizes constantly (URL bar collapse, safe-area insets,
 * bottom nav appearing) — without invalidateSize() the tile layer keeps its
 * old dimensions and the map renders gray/distorted until you pinch it.
 */
function MapResizer() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    // First paint can land before the layout settles — one extra pass on the
    // next frame catches container size changes that happened at mount time.
    const raf = requestAnimationFrame(() => map.invalidateSize());
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [map]);
  return null;
}

/**
 * Remembers the user's center+zoom across visits and restores it on remount
 * (tab switches, back navigation) instead of always re-fitting to all
 * markers — that refit-on-every-load is what made the map "jump" and lose
 * the area the user was looking at.
 *
 * - Mount: restore saved view if one exists, otherwise fitBounds once.
 * - `fitKey` change (new cat filter / friends toggle): refit to the new
 *   dataset — that's an explicit user action, so centering is expected.
 * - moveend: persist the current view.
 */
function MapViewPersist({ markers, fitKey }: { markers: MapMarkerData[]; fitKey: string }) {
  const map = useMap();
  const didInitRef = useRef(false);
  const lastFitKeyRef = useRef(fitKey);

  useEffect(() => {
    if (markers.length === 0) return;

    const savedRaw = sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (!didInitRef.current && savedRaw) {
      try {
        const saved = JSON.parse(savedRaw) as { lat: number; lng: number; zoom: number };
        if (typeof saved.lat === "number" && typeof saved.lng === "number" && typeof saved.zoom === "number") {
          map.setView([saved.lat, saved.lng], saved.zoom);
          didInitRef.current = true;
          return;
        }
      } catch {
        // corrupted entry — fall through to fitBounds
      }
    }

    // First visit, no saved view, or the dataset changed on purpose.
    if (!didInitRef.current || lastFitKeyRef.current !== fitKey) {
      if (markers.length === 1) {
        map.setView([markers[0].lat, markers[0].lng], 15);
      } else {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
      }
      didInitRef.current = true;
      lastFitKeyRef.current = fitKey;
    }
  }, [markers, fitKey, map]);

  useEffect(() => {
    const save = () => {
      const c = map.getCenter();
      sessionStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
    };
    map.on("moveend", save);
    return () => {
      map.off("moveend", save);
    };
  }, [map]);

  return null;
}

function ClusteredMarkers({
  markers,
  onMarkerClick,
  onClusterClick,
}: {
  markers: MapMarkerData[];
  onMarkerClick: (m: MapMarkerData) => void;
  onClusterClick: (items: MapMarkerData[]) => void;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());

  useEffect(() => {
    const handler = () => setZoom(map.getZoom());
    map.on("zoomend", handler);
    return () => {
      map.off("zoomend", handler);
    };
  }, [map]);

  const pb = getPocketBase();
  const clusters = useMemo(() => clusterize(markers, zoom), [markers, zoom]);

  return (
    <>
      {clusters.map((c, i) => {
        if (c.items.length > 1) {
          const hasOwn = c.items.some((m) => m.isOwn);
          const hasFriend = c.items.some((m) => !m.isOwn);
          const color = hasOwn && hasFriend ? MIXED_CLUSTER : hasOwn ? OWN_RING : FRIEND_RING;
          return (
            <Marker
              key={`cluster-${i}-${c.items.length}`}
              position={[c.lat, c.lng]}
              icon={createClusterIcon(c.items.length, color)}
              eventHandlers={{ click: () => onClusterClick(c.items) }}
            />
          );
        }
        const m = c.items[0];
        const thumbUrl = m.thumbFieldName
          ? `${pb.baseUrl}/api/files/photos/${m.photoId}/${m.thumbFieldName}?thumb=100x100`
          : null;
        return (
          <Marker
            key={m.id}
            position={[m.lat, m.lng]}
            icon={createCatIcon(thumbUrl, m.isOwn)}
            eventHandlers={{ click: () => onMarkerClick(m) }}
          />
        );
      })}
    </>
  );
}

export default function LeafletMap({
  markers,
  onMarkerClick,
  onClusterClick,
  fitKey,
}: {
  markers: MapMarkerData[];
  onMarkerClick: (m: MapMarkerData) => void;
  onClusterClick: (items: MapMarkerData[]) => void;
  /** Changes when the dataset changes on purpose (cat filter, friends toggle) → refit. */
  fitKey?: string;
}) {
  if (markers.length === 0) return null;

  const center: [number, number] = [markers[0].lat, markers[0].lng];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "100%", width: "100%" }}
      zoomControl={false}
      scrollWheelZoom={true}
      attributionControl={false}
    >
      <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
      <MapResizer />
      <MapViewPersist markers={markers} fitKey={fitKey ?? "all"} />
      <ClusteredMarkers markers={markers} onMarkerClick={onMarkerClick} onClusterClick={onClusterClick} />
    </MapContainer>
  );
}
