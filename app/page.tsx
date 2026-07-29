"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPocketBase } from "@/lib/pocketbase";
import { getFavorites, toggleFavorite, onFavoritesChange } from "@/lib/favorites";
import { CatCard } from "@/components/CatCard";
import { EmptyState } from "@/components/EmptyState";
import { InstallBanner } from "@/components/InstallBanner";
import { IconButton } from "@/components/ui/IconButton";
import { SearchBar } from "@/components/ui/SearchBar";
import { Chip } from "@/components/ui/Chip";
import { Sheet } from "@/components/ui/Sheet";

interface Cat {
  id: string;
  name: string;
  photoCount: number;
  lastSeen: number;
  createdAt: number;
  thumbUrl: string | null;
}

type Filter = "all" | "favorites" | "recent";
type SortMode = "recent" | "photos" | "alpha";

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export default function CollectionPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortMode>("recent");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    setFavorites(getFavorites());
    return onFavoritesChange(() => setFavorites(getFavorites()));
  }, []);

  useEffect(() => {
    if (authLoading || !user) return;
    loadCats();
  }, [user, authLoading]);

  async function loadCats() {
    setLoading(true);
    try {
      const pb = getPocketBase();
      const myId = pb.authStore.record?.id || "";
      const result = await pb.collection("cats").getList(1, 100, {
        sort: "-created",
        filter: `discoveredBy="${myId}"`,
      });

      // Latest photo per cat → grid thumbnail
      const photos = await pb.collection("photos").getList(1, 200, {
        filter: `user="${myId}"`,
        sort: "-created",
        fields: "id,cat,thumb,photo",
      });
      const thumbByCat = new Map<string, string>();
      for (const p of photos.items as any[]) {
        if (!thumbByCat.has(p.cat)) {
          const file = p.thumb || p.photo;
          if (file) thumbByCat.set(p.cat, `${pb.baseUrl}/api/files/photos/${p.id}/${file}?thumb=300x300`);
        }
      }

      setCats(
        result.items.map((item: any) => ({
          id: item.id,
          name: item.name || "Sin nombre",
          photoCount: item.photoCount || 0,
          lastSeen: new Date(item.updated || item.created).getTime(),
          createdAt: new Date(item.created).getTime(),
          thumbUrl: thumbByCat.get(item.id) || null,
        }))
      );
    } catch (err) {
      console.error("Failed to load cats:", err);
    }
    setLoading(false);
  }

  // Stable per-user Pokédex-style numbering — #1 is the first cat this user
  // ever captured, regardless of how the list below is currently sorted/filtered.
  const rankById = useMemo(() => {
    const byCaptureOrder = [...cats].sort((a, b) => a.createdAt - b.createdAt);
    return new Map(byCaptureOrder.map((c, i) => [c.id, i + 1]));
  }, [cats]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return cats
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .filter((c) => {
        if (filter === "favorites") return favorites.has(c.id);
        if (filter === "recent") return now - c.lastSeen < RECENT_WINDOW_MS;
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "recent": return b.lastSeen - a.lastSeen;
          case "photos": return b.photoCount - a.photoCount;
          case "alpha": return a.name.localeCompare(b.name);
        }
      });
  }, [cats, search, filter, sort, favorites]);

  return (
    <>
      <header className="pt-3 pb-3 flex items-center justify-between">
        <h1 className="text-[1.375rem] font-bold tracking-tight">Colección</h1>
        <div className="flex items-center gap-1">
          <IconButton
            label={searchOpen ? "Cerrar búsqueda" : "Buscar"}
            onClick={() => {
              setSearchOpen((o) => !o);
              setSearch("");
            }}
          >
            {searchOpen ? <X className="h-[22px] w-[22px]" /> : <Search className="h-[22px] w-[22px]" />}
          </IconButton>
          <IconButton label="Ordenar" onClick={() => setSortSheetOpen(true)}>
            <SlidersHorizontal className="h-[22px] w-[22px]" />
          </IconButton>
        </div>
      </header>

      {searchOpen && (
        <div className="mb-3 animate-fade-up">
          <SearchBar value={search} onChange={setSearch} placeholder="Buscar gato…" autoFocus />
        </div>
      )}

      {/* Filter chips */}
      <div className="flex gap-2 mb-4 overflow-x-auto no-scrollbar -mx-4 px-4">
        <Chip active={filter === "all"} onClick={() => setFilter("all")}>Todos</Chip>
        <Chip active={filter === "favorites"} onClick={() => setFilter("favorites")}>Favoritos</Chip>
        <Chip active={filter === "recent"} onClick={() => setFilter("recent")}>Recientes</Chip>
      </div>

      {loading || authLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square skeleton rounded-2xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        search || filter !== "all" ? (
          <p className="text-center text-catdex-text-muted py-16 text-sm">
            {search ? `No hay gatos que coincidan con “${search}”` : filter === "favorites" ? "Aún no tienes favoritos" : "Nada reciente por aquí"}
          </p>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="grid grid-cols-3 gap-3">
          {filtered.map((cat) => (
            <CatCard
              key={cat.id}
              id={cat.id}
              rank={rankById.get(cat.id) ?? 0}
              name={cat.name}
              thumbUrl={cat.thumbUrl}
              date={new Date(cat.lastSeen)}
              favorite={favorites.has(cat.id)}
              onToggleFavorite={() => toggleFavorite(cat.id)}
            />
          ))}
        </div>
      )}

      {/* Sort sheet */}
      <Sheet open={sortSheetOpen} onClose={() => setSortSheetOpen(false)}>
        <div className="px-6 pt-2 pb-4">
          <h2 className="text-base font-bold mb-3">Ordenar por</h2>
          {(
            [
              ["recent", "Más recientes"],
              ["photos", "Más fotos"],
              ["alpha", "Nombre (A–Z)"],
            ] as [SortMode, string][]
          ).map(([mode, label]) => (
            <button
              key={mode}
              onClick={() => {
                setSort(mode);
                setSortSheetOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-2xl text-[0.9375rem] font-medium transition-colors ${
                sort === mode ? "bg-catdex-orange/10 text-catdex-orange" : "text-catdex-text active:bg-catdex-input-bg"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Sheet>

      <InstallBanner />
    </>
  );
}
