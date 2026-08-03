"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";
import { TopBar } from "@/components/ui/TopBar";
import { AchievementCircle } from "@/components/AchievementBadge";

const RARITY_STYLE: Record<string, string> = {
  Común: "bg-catdex-input-bg text-catdex-text-muted",
  Raro: "bg-catdex-orange/10 text-catdex-orange",
  Épico: "bg-[#8B5CF6]/10 text-[#8B5CF6]",
  Legendario: "bg-catdex-orange text-white",
};

export default function AchievementsPage() {
  const [unlockedAt, setUnlockedAt] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUnlocked();
  }, []);

  /** Reads the persisted rows written by pb_hooks/achievements.pb.js. */
  async function loadUnlocked() {
    try {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;
      const rows = await pb
        .collection("achievements")
        .getFullList({ filter: `user="${userId}"`, fields: "badgeCode,unlockedAt" });
      setUnlockedAt(new Map(rows.map((r: any) => [r.badgeCode, r.unlockedAt])));
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load achievements:", err);
    }
    setLoading(false);
  }

  const entries = Object.entries(ACHIEVEMENT_DEFS);
  const unlockedCount = entries.filter(([key]) => unlockedAt.has(key)).length;

  return (
    <div className="space-y-5">
      <TopBar back backHref="/profile" title="Logros" />

      <p className="text-sm text-catdex-text-muted px-1 -mt-2">
        {loading ? "Cargando…" : `${unlockedCount} de ${entries.length} desbloqueados`}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {entries.map(([key, def]) => {
          const date = unlockedAt.get(key);
          const isUnlocked = date != null;
          return (
            <div
              key={key}
              className={clsx(
                "card p-4 flex flex-col items-center text-center gap-2",
                !isUnlocked && "opacity-45"
              )}
            >
              <AchievementCircle badgeCode={key} locked={!isUnlocked} className="w-16 h-16" />
              <p className="text-[0.8125rem] font-semibold leading-tight">{def.name}</p>
              <p className="text-[0.6875rem] text-catdex-text-muted leading-snug -mt-1">
                {def.description}
              </p>
              {isUnlocked && (
                <p className="text-[0.6875rem] text-catdex-text-muted -mt-1">
                  {new Date(date).toLocaleDateString("es-ES", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                  })}
                </p>
              )}
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
