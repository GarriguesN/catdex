"use client";

import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import {
  Cat,
  Layers,
  Crown,
  Camera,
  Aperture,
  Dice5,
  Moon,
  Sunrise,
  Map,
  Compass,
  Heart,
  Repeat,
  CloudRain,
  Flame,
  Trophy,
  PenLine,
  NotebookPen,
  Globe,
  Award,
} from "lucide-react";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";

/** Icon-name → component map (same pattern as LEFT_ITEMS/RIGHT_ITEMS in BottomNav). */
const ACHIEVEMENT_ICONS: Record<string, LucideIcon> = {
  Cat,
  Layers,
  Crown,
  Camera,
  Aperture,
  Dice5,
  Moon,
  Sunrise,
  Map,
  Compass,
  Heart,
  Repeat,
  CloudRain,
  Flame,
  Trophy,
  PenLine,
  NotebookPen,
  Globe,
};

/** White circle, orange outline, orange icon — the mockup badge style. */
export function AchievementCircle({
  badgeCode,
  locked,
  className,
}: {
  badgeCode: string;
  locked?: boolean;
  className?: string;
}) {
  const def = ACHIEVEMENT_DEFS[badgeCode];
  const Icon = (def && ACHIEVEMENT_ICONS[def.icon]) || Award;
  return (
    <span
      className={clsx(
        "rounded-full bg-catdex-surface border-2 flex items-center justify-center shrink-0",
        locked ? "border-catdex-hairline text-catdex-gray-light" : "border-catdex-orange text-catdex-orange",
        className
      )}
    >
      <Icon className="h-[45%] w-[45%]" strokeWidth={2} />
    </span>
  );
}

/** Circular badge + name + unlock date, as in the "Logros recientes" card. */
export function AchievementBadge({
  badgeCode,
  unlockedAt,
  locked,
}: {
  badgeCode: string;
  unlockedAt?: number;
  locked?: boolean;
}) {
  const def = ACHIEVEMENT_DEFS[badgeCode];
  return (
    <div className={clsx("flex flex-col items-center text-center gap-1.5 w-20 shrink-0", locked && "opacity-45")}>
      <AchievementCircle badgeCode={badgeCode} locked={locked} className="w-16 h-16" />
      <p className="text-[0.6875rem] font-semibold leading-tight">{def?.name || badgeCode}</p>
      {unlockedAt && (
        <p className="text-[0.625rem] text-catdex-text-muted leading-none -mt-0.5">
          {new Date(unlockedAt).toLocaleDateString("es-ES", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </p>
      )}
    </div>
  );
}
