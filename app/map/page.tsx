"use client";

import { useEffect, useState, useMemo } from "react";
import { ArrowLeft, MapPin, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import dynamic from "next/dynamic";

const LazyMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => <div className="skeleton h-[60dvh] w-full rounded-xl flex items-center justify-center"><span className="text-catdex-text-muted">Cargando mapa…</span></div>,
});

interface MapMarkerData { id: string; catId: string; catName: string; thumbBlobId: string; lat: number; lng: number; takenAt: number; }

function MapPageInner() {
  const searchParams = useSearchParams();
  const filterCatId = searchParams.get("catId");
  const [markers, setMarkers] = useState<MapMarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);

  useEffect(() => { loadMarkers(); }, [filterCatId]);

  async function loadMarkers() {
    try {
      const url = filterCatId ? `/api/cats/${filterCatId}` : "/api/cats";
      const res = await fetch(url);
      if (!res.ok) { setLoading(false); return; }
      
      let catsWithPhotos: any[];
      if (filterCatId) {
        const cat = await res.json();
        catsWithPhotos = [cat];
      } else {
        catsWithPhotos = await res.json();
      }

      const enriched: MapMarkerData[] = [];
      for (const cat of catsWithPhotos) {
        const photos = cat.photos || [];
        for (const p of photos) {
          if (p.lat && p.lng) {
            enriched.push({
              id: p.id, catId: cat.id, catName: cat.name,
              thumbBlobId: p.id, lat: p.lat, lng: p.lng, takenAt: p.taken_at,
            });
          }
        }
      }
      enriched.sort((a, b) => b.takenAt - a.takenAt);
      setMarkers(enriched);
    } catch {}
    setLoading(false);
  }

  const catName = useMemo(() => {
    if (!filterCatId || markers.length === 0) return null;
    return markers[0].catName;
  }, [filterCatId, markers]);

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg"><ArrowLeft className="h-5 w-5" /></Link>
        <div><h1 className="text-xl font-bold">{catName ? `Mapa de ${catName}` : "Mapa"}</h1></div>
        <span className="ml-auto text-sm text-catdex-text-muted">{markers.length} punto{markers.length !== 1 ? "s" : ""}</span>
      </div>

      {loading ? <div className="skeleton h-[60dvh] w-full rounded-xl" /> :
       markers.length === 0 ? (
        <div className="empty-state"><MapPin className="h-12 w-12 text-catdex-text-muted mb-4" /><p className="text-lg font-medium">Sin ubicaciones</p></div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border-2 border-catdex-border">
          <LazyMap markers={markers} onMarkerClick={setSelectedMarker} />
        </div>
      )}

      {selectedMarker && (
        <div className="fixed bottom-12 left-0 right-0 z-40 bg-white border-t-2 border-catdex-orange rounded-t-2xl p-4 animate-pop-in sm:bottom-0">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-lg overflow-hidden border-2 border-catdex-border bg-catdex-input-bg flex items-center justify-center text-xl">🐱</div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">{selectedMarker.catName}</p>
              <p className="text-xs text-catdex-text-muted">{selectedMarker.lat.toFixed(4)}, {selectedMarker.lng.toFixed(4)} · {new Date(selectedMarker.takenAt).toLocaleDateString("es-ES")}</p>
            </div>
            <Link href={`/cat?id=${selectedMarker.catId}`} className="btn-pokedex text-xs px-3 py-1.5">Ver ficha</Link>
            <button onClick={() => setSelectedMarker(null)} className="p-1.5 rounded-lg hover:bg-catdex-input-bg"><X className="h-4 w-4 text-catdex-text-muted" /></button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MapPage() {
  return <Suspense fallback={<div className="py-8"><div className="skeleton h-[60dvh] w-full rounded-xl" /></div>}><MapPageInner /></Suspense>;
}
