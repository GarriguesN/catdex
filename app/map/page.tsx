"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { MapPin, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { listFriends } from "@/lib/friends";
import { isShowFriendsEnabled, setShowFriendsEnabled } from "@/lib/map-prefs";
import { IconButton } from "@/components/ui/IconButton";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Toggle";
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
  const [clusterCats, setClusterCats] = useState<MapMarkerData[] | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [showFriends, setShowFriends] = useState(false);

  useEffect(() => {
    setShowFriends(isShowFriendsEnabled());
  }, []);

  useEffect(() => {
    loadMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterCatId, showFriends]);

  async function loadMarkers() {
    setLoading(true);
    try {
      const pb = getPocketBase();
      const myId = pb.authStore.record?.id || "";
      const catClause = filterCatId ? ` && cat="${filterCatId}"` : "";

      // Own captures + (optionally) friends' — two queries merged client-side,
      // each marker tagged with isOwn for the ring color.
      const queries = [
        pb.collection("photos").getList(1, 200, {
          filter: `user="${myId}" && lat!=null${catClause}`,
          sort: "-created",
          expand: "cat,user",
        }),
      ];
      if (showFriends) {
        const friends = await listFriends().catch(() => []);
        if (friends.length > 0) {
          const friendClause = friends.map((f) => `user="${f.friend.id}"`).join(" || ");
          queries.push(
            pb.collection("photos").getList(1, 200, {
              filter: `(${friendClause}) && lat!=null${catClause}`,
              sort: "-created",
              expand: "cat,user",
            })
          );
        }
      }
      const results = await Promise.all(queries);

      // One marker per cat, not per photo — keep only each cat's most
      // recent geotagged photo (latest location + thumbnail).
      const latestByCatId = new Map<string, MapMarkerData>();
      for (const result of results) {
        for (const p of result.items as any[]) {
          if (p.lat && p.lng) {
            const takenAt = new Date(p.created).getTime();
            const existing = latestByCatId.get(p.cat);
            if (existing && existing.takenAt >= takenAt) continue;
            latestByCatId.set(p.cat, {
              id: p.id,
              catId: p.cat,
              catName: p.expand?.cat?.name || "Gato",
              thumbFieldName: p.photo || undefined,
              photoId: p.id,
              lat: p.lat,
              lng: p.lng,
              takenAt,
              isOwn: p.user === myId,
              ownerName: p.user === myId ? undefined : p.expand?.user?.name || "Amigo",
            });
          }
        }
      }
      const enriched = [...latestByCatId.values()].sort((a, b) => b.takenAt - a.takenAt);
      setMarkers(enriched);
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load markers:", err);
    }
    setLoading(false);
  }

  function toggleShowFriends(enabled: boolean) {
    setShowFriends(enabled);
    setShowFriendsEnabled(enabled);
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
    `${pb.baseUrl}/api/files/photos/${selectedMarker.photoId}/${selectedMarker.thumbFieldName}?thumb=100x100f`;

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
            No puedes ver el mapa ni los gatos de tus amigos hasta que captures tu primer gato
          </p>
        </div>
      ) : (
        // Note: isolate below contains Leaflet's internal pane z-indexes
        // (up to 600+) so they can't escape and render above fixed UI.
        <div className="relative isolate flex-1 rounded-3xl overflow-hidden shadow-soft">
          <LazyMap markers={markers} onMarkerClick={setSelectedMarker} onClusterClick={setClusterCats} />
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
                {!selectedMarker.isOwn && selectedMarker.ownerName && (
                  <p className="text-[0.8125rem] font-semibold text-catdex-blue mt-0.5">
                    Captura de {selectedMarker.ownerName}
                  </p>
                )}
              </div>
            </div>
            <Link href={`/cat?id=${selectedMarker.catId}`} className="btn-primary w-full mt-5">
              Ver ficha
            </Link>
          </div>
        )}
      </Sheet>

      {/* Cluster list sheet — tapping a cluster's count opens this instead
          of just zooming in, since at some zoom levels pins never fully
          separate (e.g. two cats seen at the exact same spot). */}
      <Sheet open={!!clusterCats} onClose={() => setClusterCats(null)}>
        {clusterCats && (
          <div className="px-6 pt-2 pb-4 max-h-[60dvh] overflow-y-auto">
            <h2 className="text-base font-bold mb-3">{clusterCats.length} gatos en esta zona</h2>
            <div className="space-y-1">
              {clusterCats.map((m) => {
                const thumb = m.thumbFieldName
                  ? `${pb.baseUrl}/api/files/photos/${m.photoId}/${m.thumbFieldName}?thumb=100x100f`
                  : null;
                return (
                  <Link
                    key={m.id}
                    href={`/cat?id=${m.catId}`}
                    onClick={() => setClusterCats(null)}
                    className="flex items-center gap-3 -mx-2 p-2 rounded-2xl active:bg-catdex-input-bg transition-colors"
                  >
                    <div className="w-12 h-12 rounded-xl overflow-hidden bg-catdex-input-bg flex items-center justify-center text-xl shrink-0">
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="w-full h-full object-cover" />
                      ) : (
                        "🐾"
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{m.catName}</p>
                      {!m.isOwn && m.ownerName && (
                        <p className="text-[0.75rem] text-catdex-blue font-semibold">Captura de {m.ownerName}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </Sheet>

      {/* Cat filter sheet */}
      <Sheet open={filterSheetOpen} onClose={() => setFilterSheetOpen(false)}>
        <div className="px-6 pt-2 pb-4 max-h-[60dvh] overflow-y-auto">
          <div className="flex items-center justify-between gap-3 py-2 mb-3 border-b border-catdex-hairline pb-4">
            <div>
              <p className="text-[0.9375rem] font-semibold">Mostrar capturas de amigos</p>
              <p className="text-[0.75rem] text-catdex-text-muted mt-0.5">En azul, sobre las tuyas</p>
            </div>
            <Toggle checked={showFriends} onChange={toggleShowFriends} label="Mostrar capturas de amigos" />
          </div>
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
