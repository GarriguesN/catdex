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
import "leaflet/dist/leaflet.css";

// @ts-expect-error
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface MapMarkerData {
  id: string;
  catId: string;
  catName: string;
  thumbBlobId: string;
  lat: number;
  lng: number;
  takenAt: number;
}

function createCatIcon(thumbUrl: string | null): L.DivIcon {
  return L.divIcon({
    className: "cat-marker",
    html: `<div style="
      width:40px;height:40px;border-radius:50%;
      border:2px solid #FF8A26;overflow:hidden;
      background:#fff;
      ${thumbUrl ? `background-image:url(${thumbUrl});background-size:cover;background-position:center;` : ""}
      display:flex;align-items:center;justify-content:center;
      font-size:18px;
    ">${thumbUrl ? "" : "🐱"}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -24],
  });
}

function FitBounds({ markers }: { markers: MapMarkerData[] }) {
  const map = useMap();
  useEffect(() => {
    if (markers.length === 0) return;
    if (markers.length === 1) { map.setView([markers[0].lat, markers[0].lng], 15); return; }
    const bounds = L.latLngBounds(markers.map(m => [m.lat, m.lng] as [number, number]));
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 });
  }, [markers, map]);
  return null;
}

export default function LeafletMap({ markers, onMarkerClick }: { markers: MapMarkerData[]; onMarkerClick: (m: MapMarkerData) => void }) {
  if (markers.length === 0) return null;
  const center: [number, number] = [markers[0].lat, markers[0].lng];

  return (
    <MapContainer center={center} zoom={13} style={{ height: "60dvh", width: "100%" }} zoomControl={true} scrollWheelZoom={true}>
      <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <FitBounds markers={markers} />
      {markers.map(m => {
        const thumbUrl = m.thumbBlobId ? `/api/photos/${m.thumbBlobId}?thumb=1` : null;
        return (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={createCatIcon(thumbUrl)}
            eventHandlers={{ click: () => onMarkerClick(m) }}>
            <Popup><div style={{ minWidth: 120 }}><strong>{m.catName}</strong><br /><small>{new Date(m.takenAt).toLocaleDateString("es-ES")}</small></div></Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
