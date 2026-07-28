"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap } from "react-leaflet";
import L from "leaflet";
import { db, type Photo } from "@/lib/db";

// Fix Leaflet default icon paths
import "leaflet/dist/leaflet.css";

// @ts-expect-error
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface MiniMapProps {
  catId: string;
}

function FitBoundsOnce({ photos }: { photos: (Photo & { lat: number; lng: number })[] }) {
  const map = useMap();

  useEffect(() => {
    if (photos.length === 0) return;
    if (photos.length === 1) {
      map.setView([photos[0].lat, photos[0].lng], 15);
      return;
    }
    const bounds = L.latLngBounds(
      photos.map((p) => [p.lat, p.lng] as [number, number])
    );
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 16 });
  }, [photos, map]);

  return null;
}

export default function MiniMap({ catId }: MiniMapProps) {
  const [photos, setPhotos] = useState<(Photo & { lat: number; lng: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPhotos();
  }, [catId]);

  async function loadPhotos() {
    const all = await db.photos.where("catId").equals(catId).toArray();
    const withLoc = all.filter(
      (p) => p.lat !== undefined && p.lng !== undefined
    ) as (Photo & { lat: number; lng: number })[];
    withLoc.sort((a, b) => b.takenAt - a.takenAt);
    setPhotos(withLoc);
    setLoading(false);
  }

  if (loading) return <div className="skeleton h-32 w-full rounded-lg" />;
  if (photos.length === 0) return null;

  const center: [number, number] = [photos[0].lat, photos[0].lng];

  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ height: 160 }}>
      <MapContainer
        center={center}
        zoom={14}
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
        scrollWheelZoom={false}
        dragging={true}
        touchZoom={false}
        doubleClickZoom={false}
        attributionControl={false}
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitBoundsOnce photos={photos} />
        {photos.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} />
        ))}
      </MapContainer>
    </div>
  );
}
