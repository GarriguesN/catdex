"use client";

import { useEffect, useState } from "react";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements";

interface BadgeUnlockProps {
  achievementIds: string[];
  onClose: () => void;
}

export function BadgeUnlock({ achievementIds, onClose }: BadgeUnlockProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger confetti + vibration
    setVisible(true);
    try {
      navigator.vibrate?.([100, 50, 200]);
    } catch {
      // vibration not supported
    }
    // Dynamic import confetti (small)
    import("canvas-confetti").then((confetti) => {
      confetti.default({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#dc2626", "#fbbf24", "#10b981", "#3b82f6"],
      });
    });
  }, []);

  if (!visible || achievementIds.length === 0) return null;

  return (
    <div className="fixed inset-0 z-50 bg-pokedex-black/95 flex flex-col items-center justify-center p-6 animate-pop-in">
      <p className="text-sm text-pokedex-yellow font-semibold mb-2">
        🏆 ¡Logro desbloqueado!
      </p>
      <div className="flex flex-wrap gap-4 justify-center mb-6">
        {achievementIds.map((id) => {
          const def = ACHIEVEMENT_DEFS[id];
          if (!def) return null;
          return (
            <div
              key={id}
              className="flex flex-col items-center p-4 rounded-xl bg-pokedex-gray-dark border border-pokedex-yellow/30"
            >
              <span className="text-4xl mb-2">{def.emoji}</span>
              <span className="text-sm font-bold">{def.name}</span>
              <span className="text-[10px] text-muted-foreground">
                {def.rarity}
              </span>
            </div>
          );
        })}
      </div>
      <button onClick={onClose} className="btn-pokedex">
        ¡Genial!
      </button>
    </div>
  );
}
