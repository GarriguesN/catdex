"use client";

import { useState, useEffect } from "react";
import { db, type Cat } from "@/lib/db";
import { CatAvatar } from "./CatAvatar";
import { Plus, Search } from "lucide-react";

interface CatPickerProps {
  onSelect: (catId: string | null) => void; // null = new cat
  onCancel: () => void;
}

export function CatPicker({ onSelect, onCancel }: CatPickerProps) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCats();
  }, []);

  async function loadCats() {
    const all = await db.cats.toArray();
    all.sort((a, b) => b.lastSeen - a.lastSeen);
    setCats(all);
    setLoading(false);
  }

  const filtered = cats.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 bg-pokedex-black flex flex-col animate-pop-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3">
        <button
          onClick={onCancel}
          className="btn-pokedex-secondary text-xs px-3 py-1.5"
        >
          Cancelar
        </button>
        <h2 className="text-lg font-bold flex-1">¿Qué gato es?</h2>
        <button
          onClick={() => onSelect(null)}
          className="btn-pokedex text-xs px-3 py-1.5 flex items-center gap-1"
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo
        </button>
      </div>

      {/* Search */}
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            className="input-pokedex pl-8"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-16 rounded-lg" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            {search ? (
              <>
                <p className="text-lg mb-2">🔍</p>
                <p>Sin resultados para &ldquo;{search}&rdquo;</p>
              </>
            ) : (
              <>
                <p className="text-lg mb-2">🐱</p>
                <p>No hay gatos aún. ¡Crea el primero!</p>
                <button
                  onClick={() => onSelect(null)}
                  className="btn-pokedex mt-4"
                >
                  + Nuevo gato
                </button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className="w-full card-pokedex p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform"
              >
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 border border-border">
                  <CatAvatar blobId={cat.thumbBlobId} size="sm" className="w-full h-full" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {cat.photoCount} foto{cat.photoCount !== 1 ? "s" : ""}
                    {" · "}
                    {new Date(cat.lastSeen).toLocaleDateString("es-ES")}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
