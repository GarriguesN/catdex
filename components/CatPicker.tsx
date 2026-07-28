"use client";

import { useState, useEffect } from "react";
import { Plus, Search } from "lucide-react";

interface Cat {
  id: string; name: string; photo_count: number; last_seen: number; thumb_blob_id: string;
}

interface CatPickerProps {
  onSelect: (catId: string | null) => void;
  onCancel: () => void;
}

export function CatPicker({ onSelect, onCancel }: CatPickerProps) {
  const [cats, setCats] = useState<Cat[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadCats(); }, []);

  async function loadCats() {
    try {
      const res = await fetch("/api/cats");
      if (res.ok) setCats(await res.json());
    } catch {}
    setLoading(false);
  }

  const filtered = cats.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="fixed inset-0 z-50 bg-catdex-cream flex flex-col animate-pop-in">
      <div className="p-4 border-b-2 border-catdex-border flex items-center gap-3">
        <button onClick={onCancel} className="btn-pokedex-secondary text-xs px-3 py-1.5">Cancelar</button>
        <h2 className="text-lg font-bold flex-1">¿Qué gato es?</h2>
        <button onClick={() => onSelect(null)} className="btn-pokedex text-xs px-3 py-1.5 flex items-center gap-1"><Plus className="h-3.5 w-3.5" />Nuevo</button>
      </div>
      <div className="px-4 pt-3">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-catdex-text-muted" />
          <input className="input-pokedex pl-8" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-catdex-text-muted">
            {search ? <><p className="text-lg mb-2">🔍</p><p>Sin resultados</p></> : <><p className="text-lg mb-2">🐱</p><p>No hay gatos aún.</p><button onClick={() => onSelect(null)} className="btn-pokedex mt-4">+ Nuevo gato</button></>}
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(cat => (
              <button key={cat.id} onClick={() => onSelect(cat.id)} className="w-full card-pokedex p-3 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
                <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-catdex-input-bg">
                  {cat.thumb_blob_id ? <img src={`/api/photos/${cat.thumb_blob_id}?thumb=1`} alt="" className="w-full h-full object-cover" /> : <span className="w-full h-full flex items-center justify-center text-xl">🐱</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{cat.name}</p>
                  <p className="text-xs text-catdex-text-muted">{cat.photo_count} foto{cat.photo_count !== 1 ? "s" : ""}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
