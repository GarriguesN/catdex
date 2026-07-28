"use client";

import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";

interface Cat {
  id: string; name: string; photo_count: number; created_at: number;
}

export default function StatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    try {
      const res = await fetch("/api/cats");
      if (res.ok) {
        const data = await res.json();
        setCats(data);
      }
    } catch {}
    setLoading(false);
  }

  if (loading) {
    return <div className="py-8 space-y-4"><div className="skeleton h-32 w-full rounded-xl" /></div>;
  }

  const totalPhotos = cats.reduce((s, c) => s + c.photo_count, 0);
  const topCat = cats.reduce<Cat | null>((b, c) => (!b || c.photo_count > b.photo_count ? c : b), null);

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-catdex-input-bg transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Estadísticas</h1>
      </div>

      <div className="card-pokedex p-4 grid grid-cols-2 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-catdex-orange">{cats.length}</p>
          <p className="text-xs text-catdex-text-muted">Gatos</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-catdex-blue">{totalPhotos}</p>
          <p className="text-xs text-catdex-text-muted">Fotos</p>
        </div>
      </div>

      {topCat && (
        <div className="card-pokedex p-4">
          <p className="text-xs font-semibold text-catdex-text-muted mb-2">Gato más fotografiado</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{topCat.photo_count > 20 ? "📸" : "🐱"}</span>
            <div>
              <p className="font-semibold">{topCat.name}</p>
              <p className="text-xs text-catdex-text-muted">{topCat.photo_count} fotos</p>
            </div>
          </div>
        </div>
      )}

      <div>
        <h2 className="text-sm font-semibold text-catdex-text-muted mb-3">Badges</h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACHIEVEMENT_DEFS).map(([id, def]) => (
            <div key={id} className="card-pokedex p-2.5 text-center opacity-40 grayscale">
              <span className="text-2xl block mb-1">❓</span>
              <p className="text-[10px] font-medium leading-tight">{def.name}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
