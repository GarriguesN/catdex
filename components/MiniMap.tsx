"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// @ts-expect-error
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
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
      const res = await fetch(`/api/cats/${catId}`);
      if (res.ok) {
        const cat = await res.json();
        setPhotos((cat.photos || []).filter((p: any) => p.lat && p.lng));
      }
    } catch {}
    setLoading(false);
  }

  if (loading) return <div className="skeleton h-32 w-full rounded-lg" />;
  if (photos.length === 0) return null;

  return (
    <div className="rounded-lg overflow-hidden border-2 border-catdex-border" style={{ height: 160 }}>
      <MapContainer center={[photos[0].lat, photos[0].lng]} zoom={14} style={{ height: "100%", width: "100%" }}
        zoomControl={false} scrollWheelZoom={false} dragging={true} touchZoom={false} doubleClickZoom={false} attributionControl={false}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBoundsOnce photos={photos} />
        {photos.map((p, i) => <Marker key={i} position={[p.lat, p.lng]} />)}
      </MapContainer>
    </div>
  );
}
