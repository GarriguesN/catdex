"use client";

import { useEffect, useState, useMemo } from "react";
import { db, type Photo, type Cat } from "@/lib/db";
import { ArrowLeft, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Leaflet dynamic import (browser-only)
import dynamic from "next/dynamic";

const LazyMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="skeleton h-[60dvh] w-full rounded-xl flex items-center justify-center">
      <span className="text-muted-foreground">Cargando mapa…</span>
    </div>
  ),
});

// ── Inner component (reads searchParams) ──

interface MapMarker {
  id: string;
  catId: string;
  catName: string;
  thumbBlobId: string;
  lat: number;
  lng: number;
  takenAt: number;
}

function MapPageInner() {
  const searchParams = useSearchParams();
  const filterCatId = searchParams.get("catId");

  const [markers, setMarkers] = useState<MapMarker[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  useEffect(() => {
    loadMarkers();
  }, [filterCatId]);

  async function loadMarkers() {
    let photos: Photo[];
    if (filterCatId) {
      photos = await db.photos.where("catId").equals(filterCatId).toArray();
    } else {
      photos = await db.photos.toArray();
    }

    const withLoc = photos.filter(
      (p) => p.lat !== undefined && p.lng !== undefined
    ) as (Photo & { lat: number; lng: number })[];

    const enriched: MapMarker[] = [];
    for (const p of withLoc) {
      const cat = await db.cats.get(p.catId);
      enriched.push({
        id: p.id,
        catId: p.catId,
        catName: cat?.name || "Gato",
        thumbBlobId: cat?.thumbBlobId || p.id,
        lat: p.lat,
        lng: p.lng,
        takenAt: p.takenAt,
      });
    }

    enriched.sort((a, b) => b.takenAt - a.takenAt);
    setMarkers(enriched);
    setLoading(false);
  }

  const catName = useMemo(() => {
    if (!filterCatId || markers.length === 0) return null;
    return markers[0].catName;
  }, [filterCatId, markers]);

  return (
    <div className="py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href="/"
          className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold">
            {catName ? `Mapa de ${catName}` : "Mapa"}
          </h1>
        </div>
        <span className="ml-auto text-sm text-muted-foreground">
          {markers.length} punto{markers.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Map */}
      {loading ? (
        <div className="skeleton h-[60dvh] w-full rounded-xl" />
      ) : markers.length === 0 ? (
        <div className="empty-state">
          <MapPin className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Sin ubicaciones</p>
          <p className="text-sm text-muted-foreground">
            Activa el GPS al hacer fotos para verlas en el mapa
          </p>
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-border">
          <LazyMap
            markers={markers}
            onMarkerClick={setSelectedMarker}
          />
        </div>
      )}

      {/* Bottom sheet for selected marker */}
      {selectedMarker && (
        <div
          className="fixed bottom-12 left-0 right-0 z-40 bg-pokedex-gray-dark border-t-2 border-pokedex-red rounded-t-2xl p-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] animate-pop-in sm:bottom-0"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border border-border flex-shrink-0 bg-pokedex-gray-mid">
              {/* Placeholder — real thumb loaded via CatAvatar in CatPicker */}
              <span className="w-full h-full flex items-center justify-center text-xl">
                🐱
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedMarker.catName}
              </p>
              <p className="text-xs text-muted-foreground">
                {selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)}
                {" · "}
                {new Date(selectedMarker.takenAt).toLocaleDateString("es-ES")}
              </p>
            </div>
            <Link
              href={`/cat?id=${selectedMarker.catId}`}
              className="btn-pokedex text-xs px-3 py-1.5"
            >
              Ver ficha
            </Link>
            <button
              onClick={() => setSelectedMarker(null)}
              className="p-1.5 rounded-lg hover:bg-pokedex-gray-mid"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Outer component (Suspense boundary for useSearchParams) ──

export default function MapPage() {
  return (
    <Suspense
      fallback={
        <div className="py-8 space-y-4">
          <div className="skeleton h-6 w-24" />
          <div className="skeleton h-[60dvh] w-full rounded-xl" />
        </div>
      }
    >
      <MapPageInner />
    </Suspense>
  );
}
