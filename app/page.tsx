"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Flame, Search, SlidersHorizontal, X } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { getFavorites, toggleFavorite, onFavoritesChange } from "@/lib/favorites";
import { listFriends, friendAvatarUrl } from "@/lib/friends";
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
  discoverer?: { id: string; name: string; avatarUrl: string | null };
}

type Filter = "all" | "favorites" | "recent";
type SortMode = "recent" | "captureOrder" | "photos" | "alpha";
type View = "mine" | "friends";

const RECENT_WINDOW_MS = 14 * 24 * 60 * 60 * 1000;

export default function CollectionPage() {
  const { user, loading: authLoading } = useRequireAuth();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>("mine");
  const [friendsCats, setFriendsCats] = useState<Cat[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [hasFriends, setHasFriends] = useState(true);
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

  useEffect(() => {
    if (authLoading || !user || view !== "friends") return;
    loadFriendsCats();
  }, [user, authLoading, view]);

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
        fields: "id,cat,photo",
      });
      const thumbByCat = new Map<string, string>();
      for (const p of photos.items as any[]) {
        if (!thumbByCat.has(p.cat)) {
          // "f" fit mode scales the original photo to fit within the box
          // without cropping — the client-generated square "thumb" field
          // is never used for display since old captures baked a stretch
          // bug into it that no amount of CSS can undo.
          if (p.photo) thumbByCat.set(p.cat, `${pb.baseUrl}/api/files/photos/${p.id}/${p.photo}?thumb=300x300f`);
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
      if (!isAbortError(err)) console.error("Failed to load cats:", err);
    }
    setLoading(false);
  }

  async function loadFriendsCats() {
    setFriendsLoading(true);
    try {
      const friends = await listFriends();
      setHasFriends(friends.length > 0);
      if (friends.length === 0) {
        setFriendsCats([]);
        setFriendsLoading(false);
        return;
      }

      const pb = getPocketBase();
      const friendIds = friends.map((f) => f.friend.id);
      const catsFilter = friendIds.map((id) => `discoveredBy="${id}"`).join(" || ");
      const result = await pb.collection("cats").getList(1, 100, {
        sort: "-created",
        filter: catsFilter,
        expand: "discoveredBy",
      });

      // Latest photo per cat, across all friends → grid thumbnail
      const photosFilter = friendIds.map((id) => `user="${id}"`).join(" || ");
      const photos = await pb.collection("photos").getList(1, 500, {
        filter: photosFilter,
        sort: "-created",
        fields: "id,cat,photo",
      });
      const thumbByCat = new Map<string, string>();
      for (const p of photos.items as any[]) {
        if (!thumbByCat.has(p.cat)) {
          // "f" fit mode scales the original photo to fit within the box
          // without cropping — the client-generated square "thumb" field
          // is never used for display since old captures baked a stretch
          // bug into it that no amount of CSS can undo.
          if (p.photo) thumbByCat.set(p.cat, `${pb.baseUrl}/api/files/photos/${p.id}/${p.photo}?thumb=300x300f`);
        }
      }

      setFriendsCats(
        result.items.map((item: any) => {
          const discoveredBy = item.expand?.discoveredBy;
          return {
            id: item.id,
            name: item.name || "Sin nombre",
            photoCount: item.photoCount || 0,
            lastSeen: new Date(item.updated || item.created).getTime(),
            createdAt: new Date(item.created).getTime(),
            thumbUrl: thumbByCat.get(item.id) || null,
            discoverer: discoveredBy
              ? { id: discoveredBy.id, name: discoveredBy.name || "Sin nombre", avatarUrl: friendAvatarUrl(discoveredBy) }
              : undefined,
          };
        })
      );
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load friends' cats:", err);
    }
    setFriendsLoading(false);
  }

  // Stable per-user Pokédex-style numbering — #1 is the first cat this user
  // ever captured, regardless of how the list below is currently sorted/filtered.
  const rankById = useMemo(() => {
    const byCaptureOrder = [...cats].sort((a, b) => a.createdAt - b.createdAt);
    return new Map(byCaptureOrder.map((c, i) => [c.id, i + 1]));
  }, [cats]);

  const filtered = useMemo(() => {
    const now = Date.now();
    const source = view === "mine" ? cats : friendsCats;
    return source
      .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
      .filter((c) => {
        if (filter === "favorites") return favorites.has(c.id);
        if (filter === "recent") return now - c.lastSeen < RECENT_WINDOW_MS;
        return true;
      })
      .sort((a, b) => {
        switch (sort) {
          case "recent": return b.lastSeen - a.lastSeen;
          case "captureOrder": return a.createdAt - b.createdAt;
          case "photos": return b.photoCount - a.photoCount;
          case "alpha": return a.name.localeCompare(b.name);
        }
      });
  }, [cats, friendsCats, view, search, filter, sort, favorites]);

  const showingLoading = view === "mine" ? loading || authLoading : friendsLoading;

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

      {/* Mi colección / Amigos */}
      <div className="flex bg-catdex-input-bg rounded-full p-1 mb-4">
        <button
          onClick={() => setView("mine")}
          className={clsx(
            "flex-1 rounded-full py-2 text-[0.8125rem] font-semibold transition-colors",
            view === "mine" ? "bg-catdex-surface shadow-soft text-catdex-text" : "text-catdex-text-muted"
          )}
        >
          Mi colección
        </button>
        <button
          onClick={() => setView("friends")}
          className={clsx(
            "flex-1 rounded-full py-2 text-[0.8125rem] font-semibold transition-colors",
            view === "friends" ? "bg-catdex-surface shadow-soft text-catdex-text" : "text-catdex-text-muted"
          )}
        >
          Amigos
        </button>
      </div>

      {(user?.currentStreak || 0) > 0 && (
        <div className="flex items-center gap-2.5 bg-catdex-orange/10 rounded-2xl px-4 py-3 mb-4">
          <Flame className="h-5 w-5 text-catdex-orange shrink-0" />
          <p className="text-[0.8125rem] font-medium text-catdex-text">
            <span className="font-bold">
              Racha de {user!.currentStreak} día{user!.currentStreak !== 1 ? "s" : ""}
            </span>{" "}
            {user!.lastCaptureDate === new Date().toISOString().slice(0, 10)
              ? "— ¡ya has capturado hoy!"
              : "— captura hoy para no perderla"}
          </p>
        </div>
      )}

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

      {showingLoading ? (
        <div className="grid grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="aspect-square skeleton rounded-2xl" />
          ))}
        </div>
      ) : view === "friends" && !hasFriends ? (
        <div className="empty-state">
          <p className="text-4xl mb-4">🐾</p>
          <p className="font-semibold text-catdex-text">Aún no tienes amigos</p>
          <p className="text-sm text-catdex-text-muted mt-1.5 max-w-xs text-center">
            Añade amigos para ver aquí todas sus capturas
          </p>
          <Link href="/friends" className="btn-primary mt-5">
            Ir a Amigos
          </Link>
        </div>
      ) : filtered.length === 0 ? (
        search || filter !== "all" ? (
          <p className="text-center text-catdex-text-muted py-16 text-sm">
            {search ? `No hay gatos que coincidan con “${search}”` : filter === "favorites" ? "Aún no tienes favoritos" : "Nada reciente por aquí"}
          </p>
        ) : view === "friends" ? (
          <p className="text-center text-catdex-text-muted py-16 text-sm">
            Tus amigos aún no han capturado ningún gato
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
              rank={view === "mine" ? rankById.get(cat.id) ?? 0 : undefined}
              name={cat.name}
              thumbUrl={cat.thumbUrl}
              date={new Date(cat.lastSeen)}
              favorite={favorites.has(cat.id)}
              onToggleFavorite={() => toggleFavorite(cat.id)}
              discoverer={cat.discoverer}
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
              ["captureOrder", "Orden de captura"],
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
