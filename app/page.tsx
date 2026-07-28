"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-provider";
import { getPocketBase } from "@/lib/pocketbase";
import { CatCard } from "@/components/CatCard";
import { EmptyState } from "@/components/EmptyState";
import { InstallBanner } from "@/components/InstallBanner";
import { OnboardingModal, isOnboardingDone } from "@/components/OnboardingModal";
import { Search, ArrowUpDown, LogOut, Clock } from "lucide-react";

interface Cat {
  id: string;
  name: string;
  photoCount: number;
  lastSeen: number;
  thumb?: string;
  discoveredBy?: string;
  expand?: { discoveredBy?: { name?: string; email?: string } };
  collectionId?: string;
  collectionName?: string;
}

type SortMode = "recent" | "photos" | "alpha";

interface FeedItem {
  type: "discovery" | "sighting";
  catId: string;
  catName: string;
  userName: string;
  time: string;
}

export default function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (!isOnboardingDone()) {
      setShowOnboarding(true);
      setLoading(false);
      return;
    }
    loadCats();
  }, [user, authLoading]);

  async function loadCats() {
    try {
      const pb = getPocketBase();
      const result = await pb.collection("cats").getList(1, 50, {
        sort: "-created",
        expand: "discoveredBy",
      });
      setCats(result.items.map((item: any) => ({
        ...item,
        lastSeen: new Date(item.updated || item.created).getTime(),
        photoCount: item.photoCount || 0,
      })));

      // Build activity feed: recent discoveries + recent sightings
      const feedItems: FeedItem[] = [];

      // Recent discoveries (new cats)
      const recentCats = await pb.collection("cats").getList(1, 10, {
        sort: "-created",
        expand: "discoveredBy",
      });
      for (const c of recentCats.items as any[]) {
        const userName = c.expand?.discoveredBy?.name || "Alguien";
        feedItems.push({
          type: "discovery",
          catId: c.id,
          catName: c.name,
          userName,
          time: c.created,
        });
      }

      // Recent sightings (new photos of existing cats)
      const recentPhotos = await pb.collection("photos").getList(1, 10, {
        sort: "-created",
        expand: "user,cat",
      });
      for (const p of recentPhotos.items as any[]) {
        const userName = p.expand?.user?.name || "Alguien";
        const catName = p.expand?.cat?.name || "un gato";
        feedItems.push({
          type: "sighting",
          catId: p.cat,
          catName,
          userName,
          time: p.created,
        });
      }

      // Sort by time, latest first, dedup same cat+user combo
      feedItems.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime());
      setFeed(feedItems.slice(0, 10));
    } catch (err) {
      console.error("Failed to load cats:", err);
    }
    setLoading(false);
  }

  function handleLogout() {
    const pb = getPocketBase();
    pb.authStore.clear();
    router.replace("/login");
  }

  const filtered = cats
    .filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "recent": return (b.lastSeen || 0) - (a.lastSeen || 0);
        case "photos": return (b.photoCount || 0) - (a.photoCount || 0);
        case "alpha": return (a.name || "").localeCompare(b.name || "");
        default: return 0;
      }
    });

  function cycleSort() {
    setSort((s) => (s === "recent" ? "photos" : s === "photos" ? "alpha" : "recent"));
  }

  const sortLabel = sort === "recent" ? "Recientes" : sort === "photos" ? "+Fotos" : "A-Z";

  if (showOnboarding) {
    return <OnboardingModal onComplete={() => { setShowOnboarding(false); loadCats(); }} />;
  }

  if (loading || authLoading) {
    return (
      <div className="grid grid-cols-2 gap-3 pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="card-pokedex aspect-square animate-pulse bg-catdex-input-bg" />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-catdex-orange">🐱 CatDex</h1>
        <div className="flex items-center gap-2">
          <span className="text-sm text-catdex-text-muted">
            {cats.length} gato{cats.length !== 1 ? "s" : ""}
          </span>
          <button onClick={handleLogout} className="p-1.5 rounded-lg hover:bg-catdex-input-bg" title="Cerrar sesión">
            <LogOut className="h-4 w-4 text-catdex-text-muted" />
          </button>
        </div>
      </header>

      {/* Activity feed */}
      {feed.length > 0 && (
        <div className="mb-4">
          <div className="flex items-center gap-1.5 mb-2">
            <Clock className="h-3.5 w-3.5 text-catdex-text-muted" />
            <h2 className="text-xs font-semibold text-catdex-text-muted uppercase tracking-wide">Actividad reciente</h2>
          </div>
          <div className="card-pokedex divide-y divide-catdex-border">
            {feed.slice(0, 5).map((item, i) => (
              <a key={i} href={`/cat?id=${item.catId}`} className="block px-3 py-2 hover:bg-catdex-input-bg/50 transition-colors">
                <p className="text-xs">
                  <strong className="font-semibold">{item.userName}</strong>{" "}
                  {item.type === "discovery" ? (
                    <>ha descubierto un gato nuevo: <strong className="font-semibold text-catdex-orange">{item.catName}</strong></>
                  ) : (
                    <>ha avistado a <strong className="font-semibold">{item.catName}</strong></>
                  )}
                </p>
                <p className="text-[10px] text-catdex-text-muted mt-0.5">
                  {new Date(item.time).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </p>
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-catdex-text-muted" />
          <input className="input-pokedex pl-8" placeholder="Buscar gato..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button onClick={cycleSort} className="btn-pokedex-secondary flex items-center gap-1 text-xs whitespace-nowrap">
          <ArrowUpDown className="h-3.5 w-3.5" />{sortLabel}
        </button>
      </div>

      {filtered.length === 0 ? (
        search ? (
          <p className="text-center text-catdex-text-muted py-12">No hay gatos que coincidan con &ldquo;{search}&rdquo;</p>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((cat) => (
            <CatCard key={cat.id} cat={{ id: cat.id, name: cat.name, photo_count: cat.photoCount, thumb_blob_id: cat.thumb || "" }} />
          ))}
        </div>
      )}

      <InstallBanner />
    </>
  );
}
