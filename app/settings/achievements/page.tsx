"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getPocketBase } from "@/lib/pocketbase";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";
import { TopBar } from "@/components/ui/TopBar";

const RARITY_STYLE: Record<string, string> = {
  Común: "bg-catdex-input-bg text-catdex-text-muted",
  Raro: "bg-catdex-orange/10 text-catdex-orange",
  Épico: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
  Legendario: "bg-catdex-orange text-white",
};

export default function AchievementsPage() {
  const [unlocked, setUnlocked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    computeUnlocked();
  }, []);

  /** Derives unlockable achievements from the user's cats/photos. */
  async function computeUnlocked() {
    try {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;
      const [cats, photos] = await Promise.all([
        pb.collection("cats").getFullList({
          filter: `discoveredBy="${userId}"`,
          fields: "id,name,notes,manuallyNamed",
        }),
        pb.collection("photos").getFullList({ filter: `user="${userId}"`, fields: "id,created,lat" }),
      ]);

      const result = new Set<string>();
      if (cats.length >= 1) result.add("first_catch");
      if (cats.length >= 10) result.add("collector_10");
      if (cats.length >= 25) result.add("collector_25");
      if (photos.length >= 50) result.add("photographer_50");
      if (photos.length >= 500) result.add("photographer_500");
      if (cats.some((c: any) => c.manuallyNamed)) result.add("namer");
      if (cats.some((c: any) => c.notes)) result.add("notekeeper");

      const hours = photos.map((p: any) => new Date(p.created).getHours());
      if (hours.some((h) => h >= 22 || h < 5)) result.add("night_owl");
      if (hours.some((h) => h >= 5 && h < 8)) result.add("early_bird");

      const areas = new Set(
        photos.filter((p: any) => p.lat).map((p: any) => `${p.lat.toFixed(2)}`)
      );
      if (areas.size >= 3) result.add("explorer_3");
      if (areas.size >= 10) result.add("explorer_10");

      setUnlocked(result);
    } catch (err) {
      console.error("Failed to compute achievements:", err);
    }
    setLoading(false);
  }

  const entries = Object.entries(ACHIEVEMENT_DEFS);
  const unlockedCount = entries.filter(([key]) => unlocked.has(key)).length;

  return (
    <div className="space-y-5">
      <TopBar back backHref="/settings" title="Logros" />

      <p className="text-sm text-catdex-text-muted px-1 -mt-2">
        {loading ? "Calculando…" : `${unlockedCount} de ${entries.length} desbloqueados`}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, def]) => {
          const isUnlocked = unlocked.has(key);
          return (
            <div
              key={key}
              className={clsx(
                "card p-4 flex flex-col items-center text-center gap-2",
                !isUnlocked && "opacity-45 grayscale"
              )}
            >
              <span className="text-3xl leading-none">{def.emoji}</span>
              <p className="text-[0.8125rem] font-semibold leading-tight">{def.name}</p>
              <span
                className={clsx(
                  "text-[0.625rem] font-bold px-2 py-0.5 rounded-full",
                  RARITY_STYLE[def.rarity] || RARITY_STYLE["Común"]
                )}
              >
                {def.rarity}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
