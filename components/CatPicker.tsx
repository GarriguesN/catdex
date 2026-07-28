"use client";

import { useState, useEffect } from "react";
import { Plus } from "lucide-react";
import { getPocketBase } from "@/lib/pocketbase";
import { SearchBar } from "@/components/ui/SearchBar";

interface Cat {
  id: string;
  name: string;
  photoCount?: number;
  thumbUrl?: string | null;
  expand?: { discoveredBy?: { name?: string } };
}

interface CatPickerProps {
  /** Candidates pre-sorted by pHash similarity (optional — shown first) */
  suggestedIds?: string[];
  onSelect: (catId: string | null) => void;
  onCancel: () => void;
}

/** "¿Qué gato es?" — pick an existing cat or create a new one. */
export function CatPicker({ suggestedIds, onSelect, onCancel }: CatPickerProps) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCats();
  }, []);

  async function loadCats() {
    try {
      const pb = getPocketBase();
      const result = await pb.collection("cats").getList(1, 100, {
        sort: "-created",
        expand: "discoveredBy",
      });

      // Latest thumb per cat
      const photos = await pb.collection("photos").getList(1, 200, {
        sort: "-created",
        fields: "id,cat,thumb,photo",
      });
      const thumbByCat = new Map<string, string>();
      for (const p of photos.items as any[]) {
        if (!thumbByCat.has(p.cat)) {
          const file = p.thumb || p.photo;
          if (file) thumbByCat.set(p.cat, `${pb.baseUrl}/api/files/photos/${p.id}/${file}?thumb=100x100`);
        }
      }

      setCats(
        (result.items as unknown as Cat[]).map((c) => ({ ...c, thumbUrl: thumbByCat.get(c.id) || null }))
      );
    } catch (err) {
      console.error("Failed to load cats for picker:", err);
    }
    setLoading(false);
  }

  // Sort: suggested cats first (by pHash similarity), then rest by recency
  const sorted = [...cats].sort((a, b) => {
    if (suggestedIds) {
      const ai = suggestedIds.indexOf(a.id);
      const bi = suggestedIds.indexOf(b.id);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
    }
    return 0;
  });

  const filtered = sorted.filter((c) => c.name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col animate-fade-up">
      <div
        className="px-4 pb-3 flex items-center gap-3"
        style={{ paddingTop: "max(1rem, env(safe-area-inset-top))" }}
      >
        <button onClick={onCancel} className="btn-ghost -ml-3">
          Cancelar
        </button>
        <h2 className="text-lg font-bold flex-1 text-center">¿Qué gato es?</h2>
        <button
          onClick={() => onSelect(null)}
          className="inline-flex items-center gap-1 bg-catdex-orange text-white rounded-full px-4 py-2 text-[0.8125rem] font-semibold shadow-[0_2px_8px_rgba(255,138,38,0.3)] active:scale-95 transition-transform"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          Nuevo
        </button>
      </div>

      <div className="px-4 pb-3">
        <SearchBar value={search} onChange={setSearch} placeholder="Buscar…" autoFocus />
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-[4.5rem]" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-14 text-catdex-text-muted">
            <p className="text-3xl mb-3">🐱</p>
            <p className="text-sm">{search ? "Sin resultados" : "No hay gatos aún."}</p>
            <button onClick={() => onSelect(null)} className="btn-primary mt-5">
              <Plus className="h-4 w-4" /> Nuevo gato
            </button>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map((cat) => (
              <button
                key={cat.id}
                onClick={() => onSelect(cat.id)}
                className="w-full card p-3 flex items-center gap-3.5 text-left transition-transform active:scale-[0.99]"
              >
                <div className="w-13 h-13 min-w-[3.25rem] min-h-[3.25rem] rounded-2xl overflow-hidden bg-catdex-input-bg flex items-center justify-center text-xl">
                  {cat.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={cat.thumbUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    "🐱"
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-catdex-text-muted mt-0.5">
                    {cat.photoCount || 0} foto{(cat.photoCount || 0) !== 1 ? "s" : ""}
                    {cat.expand?.discoveredBy?.name ? ` · por ${cat.expand.discoveredBy.name}` : ""}
                  </p>
                </div>
                {suggestedIds?.includes(cat.id) && (
                  <span className="text-[0.625rem] bg-catdex-orange/10 text-catdex-orange px-2.5 py-1 rounded-full font-bold whitespace-nowrap">
                    Posible match
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
