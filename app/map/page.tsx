"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getPocketBase } from "@/lib/pocketbase";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import type { MapMarkerData } from "@/components/LeafletMap";

const LazyMap = dynamic(() => import("@/components/LeafletMap"), {
  ssr: false,
  loading: () => (
    <div className="skeleton h-full w-full flex items-center justify-center">
      <span className="text-sm text-catdex-text-muted">Cargando mapa…</span>
    </div>
  ),
});

function MapPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const filterCatId = searchParams.get("catId");
  const [markers, setMarkers] = useState<MapMarkerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarker, setSelectedMarker] = useState<MapMarkerData | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  useEffect(() => {
    loadMarkers();
  }, [filterCatId]);

  async function loadMarkers() {
    setLoading(true);
    try {
      const pb = getPocketBase();
      const filters = filterCatId ? `cat="${filterCatId}"` : "lat!=null";
      const result = await pb.collection("photos").getList(1, 200, {
        filter: filters,
        sort: "-created",
        expand: "cat",
      });

      const enriched: MapMarkerData[] = [];
      for (const p of result.items as any[]) {
        if (p.lat && p.lng) {
          enriched.push({
            id: p.id,
            catId: p.cat,
            catName: p.expand?.cat?.name || "Gato",
            thumbFieldName: p.thumb || p.photo || undefined,
            photoId: p.id,
            lat: p.lat,
            lng: p.lng,
            takenAt: new Date(p.created).getTime(),
          });
        }
      }
      enriched.sort((a, b) => b.takenAt - a.takenAt);
      setMarkers(enriched);
    } catch (err) {
      console.error("Failed to load markers:", err);
    }
    setLoading(false);
  }

  const catsWithLocations = useMemo(() => {
    const byId = new Map<string, string>();
    for (const m of markers) if (!byId.has(m.catId)) byId.set(m.catId, m.catName);
    return [...byId.entries()].map(([id, name]) => ({ id, name }));
  }, [markers]);

  const filteredCatName = filterCatId ? catsWithLocations.find((c) => c.id === filterCatId)?.name : null;

  const pb = getPocketBase();
  const selectedThumb =
    selectedMarker?.thumbFieldName &&
    `${pb.baseUrl}/api/files/photos/${selectedMarker.photoId}/${selectedMarker.thumbFieldName}?thumb=100x100`;

  return (
    <div className="flex flex-col h-[calc(100dvh-6rem)]">
      <header className="pt-3 pb-3 flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold tracking-tight">
          {filteredCatName ? `Mapa · ${filteredCatName}` : "Mapa"}
        </h1>
        <IconButton label="Filtrar" onClick={() => setFilterSheetOpen(true)}>
          <SlidersHorizontal className="h-[22px] w-[22px]" />
        </IconButton>
      </header>

      {loading ? (
        <div className="skeleton flex-1 rounded-3xl" />
      ) : markers.length === 0 ? (
        <div className="empty-state flex-1">
          <div className="w-20 h-20 rounded-full bg-catdex-orange/10 flex items-center justify-center mb-5">
            <MapPin className="h-9 w-9 text-catdex-orange" />
          </div>
          <p className="text-lg font-bold text-catdex-text">Sin ubicaciones aún</p>
          <p className="text-sm text-catdex-text-muted mt-1.5 max-w-xs">
            Las capturas con GPS aparecerán aquí en el mapa
          </p>
        </div>
      ) : (
        // Note: isolate below contains Leaflet's internal pane z-indexes
        // (up to 600+) so they can't escape and render above fixed UI.
        <div className="relative isolate flex-1 rounded-3xl overflow-hidden shadow-soft">
          <LazyMap markers={markers} onMarkerClick={setSelectedMarker} />
        </div>
      )}

      {/* Pin preview sheet */}
      <Sheet open={!!selectedMarker} onClose={() => setSelectedMarker(null)}>
        {selectedMarker && (
          <div className="px-6 pt-2 pb-4">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-catdex-input-bg flex items-center justify-center text-2xl shrink-0">
                {selectedThumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={selectedThumb} alt="" className="w-full h-full object-cover" />
                ) : (
                  "🐾"
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-base truncate">{selectedMarker.catName}</p>
                <p className="text-[0.8125rem] text-catdex-text-muted mt-0.5">
                  {new Date(selectedMarker.takenAt).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
            </div>
            <Link href={`/cat?id=${selectedMarker.catId}`} className="btn-primary w-full mt-5">
              Ver ficha
            </Link>
          </div>
        )}
      </Sheet>

      {/* Cat filter sheet */}
      <Sheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        <div className="px-6 pt-2 pb-4 max-h-[60dvh] overflow-y-auto">
          <h2 className="text-base font-bold mb-3">Filtrar por gato</h2>
          <button
            onClick={() => {
              setFilterSheetOpen(false);
              router.push("/map");
            }}
            className={`w-full text-left px-4 py-3.5 rounded-2xl text-[0.9375rem] font-medium transition-colors ${
              !filterCatId ? "bg-catdex-orange/10 text-catdex-orange" : "active:bg-catdex-input-bg"
            }`}
          >
            Todos los gatos
          </button>
          {catsWithLocations.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setFilterSheetOpen(false);
                router.push(`/map?catId=${c.id}`);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-2xl text-[0.9375rem] font-medium transition-colors ${
                filterCatId === c.id ? "bg-catdex-orange/10 text-catdex-orange" : "active:bg-catdex-input-bg"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

export default function MapPage() {
  return (
    <Suspense fallback={<div className="pt-16 px-4"><div className="skeleton h-[60dvh] w-full rounded-3xl" /></div>}>
      <MapPageInner />
    </Suspense>
  );
}
