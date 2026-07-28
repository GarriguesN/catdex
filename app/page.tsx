"use client";

import { useEffect, useState } from "react";
import { db, type Cat } from "@/lib/db";
import { CatCard } from "@/components/CatCard";
import { FAB } from "@/components/FAB";
import { EmptyState } from "@/components/EmptyState";
import { Search, ArrowUpDown } from "lucide-react";

type SortMode = "recent" | "photos" | "alpha";

export default function HomePage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortMode>("recent");

  useEffect(() => {
    loadCats();
  }, []);

  async function loadCats() {
    const all = await db.cats.toArray();
    setCats(all);
    setLoading(false);
  }

  const filtered = cats
    .filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sort) {
        case "recent":
          return b.lastSeen - a.lastSeen;
        case "photos":
          return b.photoCount - a.photoCount;
        case "alpha":
          return a.name.localeCompare(b.name);
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
          <div key={i} className="card-pokedex aspect-square animate-pulse bg-pokedex-gray-dark" />
        ))}
      </div>
    );
  }

  return (
    <>
      <header className="py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-pokedex-red">
          🐱 CatDex
        </h1>
        <span className="text-sm text-muted-foreground">
          {cats.length} gato{cats.length !== 1 ? "s" : ""}
        </span>
      </header>

      {/* Search + Sort bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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

      {/* Grid or Empty */}
      {filtered.length === 0 ? (
        search ? (
          <p className="text-center text-muted-foreground py-12">
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
    </>
  );
}
