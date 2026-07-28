"use client";

import { useEffect, useState } from "react";
import { db, type Cat, type Achievement } from "@/lib/db";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";
import { ArrowLeft, Flame, Camera, Clock } from "lucide-react";
import Link from "next/link";

export default function StatsPage() {
  const [cats, setCats] = useState<Cat[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const [allCats, allAch] = await Promise.all([
      db.cats.toArray(),
      db.achievements.toArray(),
    ]);
    setCats(allCats);
    setAchievements(allAch);
    setLoading(false);
  }

  if (loading) {
    return (
      <div className="py-8 space-y-4">
        <div className="skeleton h-32 w-full rounded-xl" />
        <div className="skeleton h-6 w-48" />
      </div>
    );
  }

  const totalPhotos = cats.reduce((sum, c) => sum + c.photoCount, 0);
  const topCat = cats.reduce<Cat | null>(
    (best, c) => (!best || c.photoCount > best.photoCount ? c : best),
    null
  );
  const unlockedIds = new Set(achievements.map((a) => a.id));

  // Streak calculation
  const days = new Set(
    cats.map((c) => new Date(c.createdAt).toDateString())
  );
  const sorted = [...days].map((d) => new Date(d).getTime()).sort((a, b) => b - a);
  let streak = 0;
  const DAY = 86400000;
  for (let i = 0; i < sorted.length; i++) {
    if (i === 0) {
      streak = 1;
    } else if (sorted[i - 1] - sorted[i] <= DAY + 1000) {
      streak++;
    } else {
      break;
    }
  }

  return (
    <div className="py-4 space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/" className="p-2 -ml-2 rounded-lg hover:bg-pokedex-gray-mid transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-xl font-bold">Estadísticas</h1>
      </div>

      {/* Top stats card */}
      <div className="card-pokedex p-4 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-2xl font-bold text-pokedex-red">{cats.length}</p>
          <p className="text-xs text-muted-foreground">Gatos</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-pokedex-blue">{totalPhotos}</p>
          <p className="text-xs text-muted-foreground">Fotos</p>
        </div>
        <div>
          <p className="text-2xl font-bold text-pokedex-yellow">{streak}</p>
          <p className="text-xs text-muted-foreground">Racha 🔥</p>
        </div>
      </div>

      {/* Top cat */}
      {topCat && (
        <div className="card-pokedex p-4">
          <p className="text-xs font-semibold text-muted-foreground mb-2">
            Gato más fotografiado
          </p>
          <div className="flex items-center gap-3">
            <span className="text-2xl">{topCat.photoCount > 20 ? "📸" : "🐱"}</span>
            <div>
              <p className="font-semibold">{topCat.name}</p>
              <p className="text-xs text-muted-foreground">
                {topCat.photoCount} foto{topCat.photoCount !== 1 ? "s" : ""}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Badges */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground mb-3">
          Badges ({unlockedIds.size}/{Object.keys(ACHIEVEMENT_DEFS).length})
        </h2>
        <div className="grid grid-cols-3 gap-2">
          {Object.entries(ACHIEVEMENT_DEFS).map(([id, def]) => {
            const unlocked = unlockedIds.has(id);
            return (
              <div
                key={id}
                className={`card-pokedex p-2.5 text-center ${
                  unlocked ? "" : "opacity-40 grayscale"
                }`}
              >
                <span className="text-2xl block mb-1">
                  {unlocked ? def.emoji : "❓"}
                </span>
                <p className="text-[10px] font-medium leading-tight">{def.name}</p>
                <p className="text-[9px] text-muted-foreground">{def.rarity}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
