"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import { db } from "@/lib/db";

// Fix Leaflet default icon paths (webpack/bundler issue)
import "leaflet/dist/leaflet.css";

// @ts-expect-error — Leaflet icon URLs need manual fixing in bundled apps
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ── Types ──

export interface MapMarkerData {
  id: string;
  catId: string;
  catName: string;
  thumbBlobId: string;
  lat: number;
  lng: number;
  takenAt: number;
}

interface LeafletMapProps {
  markers: MapMarkerData[];
  onMarkerClick: (marker: MapMarkerData) => void;
}

// ── Custom cat marker icon ──

function createCatIcon(thumbUrl: string | null): L.DivIcon {
  return L.divIcon({
    className: "cat-marker",
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      border:2px solid #dc2626;overflow:hidden;
      background:#1a1a1a;
      ${thumbUrl ? `background-image:url(${thumbUrl});background-size:cover;background-position:center;` : ""}
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
    ">${thumbUrl ? "" : "🐱"}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

// ── Fit bounds on load ──

function FitBounds({ markers }: { markers: MapMarkerData[] }) {
  const map = useMap();

  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) {
      map.setView([markers[0].lat, markers[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(
      markers.map((m) => [m.lat, m.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [markers, map]);

  return null;
}

// ── CatMarker (individual, with thumbnail loading) ──

function CatMarker({
  marker,
  onClick,
}: {
  marker: MapMarkerData;
  onClick: (m: MapMarkerData) => void;
}) {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    loadThumb();
  }, [marker.thumbBlobId]);

  async function loadThumb() {
    try {
      const photo = await db.photos.get(marker.thumbBlobId);
      if (photo?.thumbBlob) {
        setThumbUrl(URL.createObjectURL(photo.thumbBlob));
      }
    } catch {
      // Blob not available
    }
  }

  const icon = createCatIcon(thumbUrl);

  return (
    <Marker
      position={[marker.lat, marker.lng]}
      icon={icon}
      eventHandlers={{
        click: () => onClick(marker),
      }}
    >
      <Popup>
        <div style={{ minWidth: 120 }}>
          <strong>{marker.catName}</strong>
          <br />
          <small>
            {new Date(marker.takenAt).toLocaleDateString("es-ES")}
          </small>
        </div>
      </Popup>
    </Marker>
  );
}

// ── Main Map ──

export default function LeafletMap({ markers, onMarkerClick }: LeafletMapProps) {
  if (markers.length === 0) return null;

  // Default center (will be overridden by FitBounds)
  const center: [number, number] = [markers[0].lat, markers[0].lng];

  return (
    <MapContainer
      center={center}
      zoom={13}
      style={{ height: "60dvh", width: "100%" }}
      zoomControl={true}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <FitBounds markers={markers} />

      {markers.map((m) => (
        <CatMarker key={m.id} marker={m} onClick={onMarkerClick} />
      ))}
    </MapContainer>
  );
}
