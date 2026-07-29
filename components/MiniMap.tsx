"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { getPocketBase } from "@/lib/pocketbase";

/** Orange teardrop pin with paw — matches the map design. */
const pawPin = L.divIcon({
  className: "cat-marker",
  html: `<div style="
    width:34px;height:34px;border-radius:50% 50% 50% 4px;
    transform:rotate(-45deg);
    background:#FF8A26;border:3px solid #FFFFFF;
    box-shadow:0 4px 10px rgba(34,35,38,0.3);
    display:flex;align-items:center;justify-content:center;
  "><span style="transform:rotate(45deg);font-size:15px;">🐾</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 30],
});

function FitBoundsOnce({ photos }: { photos: { lat: number; lng: number }[] }) {
  const map = useMap();
  useEffect(() => {
    if (photos.length === 0) return;
    if (photos.length === 1) { map.setView([photos[0].lat, photos[0].lng], 15); return; }
    map.fitBounds(L.latLngBounds(photos.map(p => [p.lat, p.lng] as [number, number])), { padding: [20, 20], maxZoom: 16 });
  }, [photos, map]);
  return null;
}

export default function MiniMap({ catId }: { catId: string }) {
  const [photos, setPhotos] = useState<{ lat: number; lng: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPhotos(); }, [catId]);

  async function loadPhotos() {
    try {
      const pb = getPocketBase();
      const result = await pb.collection("photos").getFullList({
        filter: `cat="${catId}" && lat!=null`,
      });
      setPhotos(result.map((p: any) => ({ lat: p.lat, lng: p.lng })));
    } catch (err) { console.error("Failed to load mini map photos:", err); }
    setLoading(false);
  }

  if (loading) return <div className="skeleton h-36 w-full rounded-2xl" />;
  if (photos.length === 0) return null;

  return (
    // isolate: Leaflet's panes (tiles/markers) carry internal z-indexes up to
    // 600+ with no stacking context of their own, so without this they'd
    // escape into the page's root stacking context and render above fixed
    // UI like the bottom nav (z-40).
    <div className="relative isolate rounded-2xl overflow-hidden" style={{ height: 160 }}>
      <MapContainer center={[photos[0].lat, photos[0].lng]} zoom={14} style={{ height: "100%", width: "100%" }}
        zoomControl={false} scrollWheelZoom={false} dragging={false} touchZoom={false} doubleClickZoom={false} attributionControl={false}>
        <TileLayer url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png" />
        <FitBoundsOnce photos={photos} />
        {photos.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} icon={pawPin} />)}
      </MapContainer>
    </div>
  );
}
