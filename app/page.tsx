"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { CatCard } from "@/components/CatCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { InstallBanner } from "@/components/InstallBanner";
import { Search, ArrowUpDown, LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

interface Cat {
  id: string;
  name: string;
  photo_count: number;
  last_seen: number;
  thumb_blob_id: string;
  manually_named: number;
}

type SortMode = "recent" | "photos" | "alpha";

export default function HomePage() {
  const { data: session } = useSession();
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    loadCats();
  }, []);

  async function loadCats() {
    try {
      const res = await fetch("/api/cats");
      if (res.ok) {
        const data = await res.json();
        setCats(data);
      }
    } catch (err) {
      console.error("Failed to load cats:", err);
    }
    setLoading(false);
  }

  const filtered = cats
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "recent": return b.last_seen - a.last_seen;
        case "photos": return b.photo_count - a.photo_count;
        case "alpha": return a.name.localeCompare(b.name);
        default: return 0;
      }
    });

  function cycleSort() {
    setSort((s) => (s === "recent" ? "photos" : s === "photos" ? "alpha" : "recent"));
  }

  const sortLabel = sort === "recent" ? "Recientes" : sort === "photos" ? "+Fotos" : "A-Z";

  if (loading) {
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
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-catdex-orange">
            🐱 CatDex
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-catdex-text-muted">
            {cats.length} gato{cats.length !== 1 ? "s" : ""}
          </span>
          {session?.user && (
            <button
              onClick={() => signOut()}
              className="p-1.5 rounded-lg hover:bg-catdex-input-bg transition-colors"
              title="Cerrar sesión"
            >
              <LogOut className="h-4 w-4 text-catdex-text-muted" />
            </button>
          )}
        </div>
      </header>

      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-catdex-text-muted" />
          <input
            className="input-pokedex pl-8"
            placeholder="Buscar gato..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <button
          onClick={cycleSort}
          className="btn-pokedex-secondary flex items-center gap-1 text-xs whitespace-nowrap"
        >
          <ArrowUpDown className="h-3.5 w-3.5" />
          {sortLabel}
        </button>
      </div>

      {filtered.length === 0 ? (
        search ? (
          <p className="text-center text-catdex-text-muted py-12">
            No hay gatos que coincidan con &ldquo;{search}&rdquo;
          </p>
        ) : (
          <EmptyState />
        )
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {filtered.map((cat) => (
            <CatCard key={cat.id} cat={cat} />
          ))}
        </div>
      )}

      <FAB />
      <InstallBanner />
    </>
  );
}
