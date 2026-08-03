"use client";

import { Clock, TrendingUp, Swords } from "lucide-react";
import clsx from "clsx";
import { weekMondayKey } from "@/lib/ranking";

/**
 * Compact header chip that shows the current competition week and how many
 * days are left until reset. Sits just below the TopBar (Fase 2.2).
 *
 * Computed client-side from weekMondayKey() — no backend call needed.
 *   - Monday..Friday:  "Semana del 3 ago · 4 días para el cierre"
 *   - Saturday onward: "Semana del 3 ago · cierra hoy" (naranja)
 */
export function WeekHeader() {
  const now = new Date();
  const mondayKey = weekMondayKey(now); // "YYYY-MM-DD" of this week's Monday
  const [yyyy, mm, dd] = mondayKey.split("-").map(Number);
  const monday = new Date(Date.UTC(yyyy, mm - 1, dd));
  // Next Monday is exactly 7 days after this week's Monday at 00:00 UTC.
  // Days remaining = ceil((nextMonday - now) / 86400000), clamped to [0,7].
  const nextMonday = new Date(monday);
  nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
  const msUntilClose = nextMonday.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.min(7, Math.ceil(msUntilClose / 86400000)));

  const isUrgent = daysLeft <= 1; // Saturday/Sunday
  const monthShort = monday.toLocaleDateString("es", { month: "short", timeZone: "UTC" });

  return (
    <div className="flex items-center justify-between gap-3 px-1">
      <div className="flex items-center gap-1.5 text-[0.75rem] text-catdex-text-secondary">
        <Clock className="h-3.5 w-3.5 text-catdex-text-muted" />
        <span className="font-semibold">Semana del {dd} {monthShort}</span>
      </div>
      <span
        className={clsx(
          "text-[0.6875rem] font-semibold uppercase tracking-wide px-2 py-1 rounded-full",
          isUrgent
            ? "bg-catdex-orange/15 text-catdex-orange"
            : "bg-catdex-input-bg text-catdex-text-secondary"
        )}
      >
        {daysLeft === 0
          ? "cierra hoy"
          : daysLeft === 1
            ? "queda 1 día"
            : `quedan ${daysLeft} días`}
      </span>
    </div>
  );
}

interface MetaBandProps {
  wins: number;
  losses: number;
  ties: number;
  bestWeekScore: number;
}

/**
 * Horizontal chip band with the user's competition metadata (Fase 2.6).
 * Kept minimal: 3 chips in one row, no scroll. Best-week is the largest
 * weekly delta the user has ever earned (computed client-side from the
 * weekly ranking's `weeklyScore`).
 *
 * Lives under the TopBar — competing with the WeekHeader for space, but
 * the WeekHeader is more important, so this one sits below it.
 */
export function MetaBand({ wins, losses, ties, bestWeekScore }: MetaBandProps) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <MetaChip icon={<Swords className="h-3.5 w-3.5" />} label="Duelos" value={`${wins}W ${ties}E ${losses}L`} />
      <MetaChip
        icon={<TrendingUp className="h-3.5 w-3.5" />}
        label="Mejor semana"
        value={`+${bestWeekScore}`}
        accent={bestWeekScore > 0}
      />
      <MetaChip
        icon={<span className="text-[0.6875rem] font-bold">W/L</span>}
        label="Ratio"
        value={wins + losses > 0 ? `${Math.round((wins / (wins + losses)) * 100)}%` : "—"}
      />
    </div>
  );
}

interface MetaChipProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}

function MetaChip({ icon, label, value, accent }: MetaChipProps) {
  return (
    <div
      className={clsx(
        "px-3 py-2 rounded-2xl flex flex-col items-start",
        accent ? "bg-catdex-orange/10" : "bg-catdex-input-bg"
      )}
    >
      <div className={clsx("inline-flex items-center gap-1 text-catdex-text-muted", accent && "text-catdex-orange")}>
        {icon}
        <span className="text-[0.6875rem] uppercase tracking-wide font-semibold">{label}</span>
      </div>
      <span className={clsx("text-[0.8125rem] font-bold mt-0.5", accent ? "text-catdex-orange" : "text-catdex-text")}>
        {value}
      </span>
    </div>
  );
}
