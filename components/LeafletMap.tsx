"use client";

import { useEffect, useMemo, useState } from "react";
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
}

/** Circular photo pin with orange ring (falls back to paw dot). */
function createCatIcon(thumbUrl: string | null): L.DivIcon {
  return L.divIcon({
    className: "cat-marker",
    html: `<div style="
      width:44px;height:44px;border-radius:50%;
      border:3px solid #FFFFFF;
      box-shadow:0 0 0 2px #FF8A26, 0 4px 10px rgba(34,35,38,0.25);
      overflow:hidden;background:#FFF7EF;
      ${thumbUrl ? `background-image:url(${thumbUrl});background-size:cover;background-position:center;` : ""}
      display:flex;align-items:center;justify-content:center;font-size:20px;
    ">${thumbUrl ? "" : "🐾"}</div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  });
}

/** Orange circle with white count — cluster pin. */
function createClusterIcon(count: number): L.DivIcon {
  const size = count >= 10 ? 44 : 38;
  return L.divIcon({
    className: "cluster-marker",
    html: `<div style="
      width:${size}px;height:${size}px;border-radius:50%;
      background:#FF8A26;border:3px solid #FFFFFF;
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

function FitBounds({ markers }: { markers: MapMarkerData[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [markers, map]);
  return null;
}

function ClusteredMarkers({
  markers,
  onMarkerClick,
}: {
  markers: MapMarkerData[];
  onMarkerClick: (m: MapMarkerData) => void;
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
          return (
            <Marker
              key={`cluster-${i}-${c.items.length}`}
              position={[c.lat, c.lng]}
              icon={createClusterIcon(c.items.length)}
              eventHandlers={{
                click: () => map.setView([c.lat, c.lng], Math.min(map.getZoom() + 2, 18), { animate: true }),
              }}
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
            icon={createCatIcon(thumbUrl)}
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
}: {
  markers: MapMarkerData[];
  onMarkerClick: (m: MapMarkerData) => void;
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
      <FitBounds markers={markers} />
      <ClusteredMarkers markers={markers} onMarkerClick={onMarkerClick} />
    </MapContainer>
  );
}
