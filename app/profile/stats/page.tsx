"use client";

import { useEffect, useMemo, useState } from "react";
import { Flame, Trophy, Heart, ChevronDown, TrendingUp } from "lucide-react";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { getFavorites } from "@/lib/favorites";
import { TopBar } from "@/components/ui/TopBar";
import { Card } from "@/components/ui/Card";
import { LineChart } from "@/components/ui/LineChart";
import { ProgressRing } from "@/components/ui/ProgressRing";
import { Sheet } from "@/components/ui/Sheet";

type Period = "week" | "month" | "all";

const PERIOD_LABEL: Record<Period, string> = {
  week: "Esta semana",
  month: "Este mes",
  all: "Todo",
};

interface PhotoRec {
  created: string;
  lat?: number;
  lng?: number;
  cat: string;
}

/** "Estadísticas completas" — the growth chart and places ring that lived
 * in /stats, now behind "Ver todos" in the profile summary card. The
 * ranking that used to live here moved to /competition (see BottomNav). */
export default function FullStatsPage() {
  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [catCreatedDates, setCatCreatedDates] = useState<Date[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>("month");
  const [periodSheetOpen, setPeriodSheetOpen] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);

  useEffect(() => {
    setFavoriteCount(getFavorites().size);
    loadData();
  }, []);

  async function loadData() {
    try {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;

      const [photosResult, catsResult] = await Promise.all([
        pb.collection("photos").getFullList({
          filter: userId ? `user="${userId}"` : "",
          fields: "created,lat,lng,cat",
        }),
        pb.collection("cats").getFullList({
          filter: userId ? `discoveredBy="${userId}"` : "",
          fields: "id,created",
        }),
      ]);

      setPhotos(photosResult as unknown as PhotoRec[]);
      setCatCreatedDates(catsResult.map((c: any) => new Date(c.created)));
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load stats:", err);
    }
    setLoading(false);
  }

  const stats = useMemo(() => {
    const now = new Date();
    const periodStart = new Date(now);
    if (period === "week") periodStart.setDate(now.getDate() - 7);
    else if (period === "month") periodStart.setDate(now.getDate() - 30);
    else periodStart.setTime(0);

    const prevStart = new Date(periodStart);
    if (period !== "all") prevStart.setTime(periodStart.getTime() - (now.getTime() - periodStart.getTime()));

    // Captures (new cats) in period + growth vs previous period
    const inPeriod = catCreatedDates.filter((d) => d >= periodStart).length;
    const inPrev =
      period === "all"
        ? 0
        : catCreatedDates.filter((d) => d >= prevStart && d < periodStart).length;
    const growth = inPrev > 0 ? Math.round(((inPeriod - inPrev) / inPrev) * 100) : null;

    // Cumulative collection growth curve across the period (8 buckets)
    const buckets = 8;
    const start = period === "all" && catCreatedDates.length > 0
      ? new Date(Math.min(...catCreatedDates.map((d) => d.getTime())))
      : periodStart;
    const span = Math.max(now.getTime() - start.getTime(), 1);
    const values: number[] = [];
    for (let i = 0; i < buckets; i++) {
      const t = start.getTime() + (span * (i + 1)) / buckets;
      values.push(catCreatedDates.filter((d) => d.getTime() <= t).length);
    }
    const fmt = (t: number) =>
      new Date(t).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    const labels = [0, 0.33, 0.66, 1].map((f) => fmt(start.getTime() + span * f));

    // Streaks — consecutive days with at least one photo
    const days = new Set(photos.map((p) => new Date(p.created).toDateString()));
    let currentStreak = 0;
    const cursor = new Date();
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toDateString())) {
      currentStreak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    let bestStreak = 0;
    const sortedDays = [...days].map((d) => new Date(d).getTime()).sort((a, b) => a - b);
    let run = 0;
    for (let i = 0; i < sortedDays.length; i++) {
      run = i > 0 && sortedDays[i] - sortedDays[i - 1] === 86400000 ? run + 1 : 1;
      bestStreak = Math.max(bestStreak, run);
    }

    // Explored places — unique ~1km areas; ring = share of photos with GPS
    const withGps = photos.filter((p) => p.lat && p.lng);
    const areas = new Set(withGps.map((p) => `${p.lat!.toFixed(2)}:${p.lng!.toFixed(2)}`));
    const gpsShare = photos.length > 0 ? withGps.length / photos.length : 0;

    return {
      captured: period === "all" ? catCreatedDates.length : inPeriod,
      growth,
      values,
      labels,
      currentStreak,
      bestStreak,
      places: areas.size,
      gpsShare,
    };
  }, [photos, catCreatedDates, period]);

  if (loading) {
    return (
      <div className="pt-3 space-y-4">
        <div className="skeleton h-10 w-40" />
        <div className="skeleton h-52 w-full" />
        <div className="grid grid-cols-2 gap-3">
          <div className="skeleton h-24" />
          <div className="skeleton h-24" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <TopBar
        back
        backHref="/profile"
        title="Estadísticas"
        actions={
          <button
            onClick={() => setPeriodSheetOpen(true)}
            className="inline-flex items-center gap-1.5 bg-catdex-surface shadow-soft rounded-full px-4 py-2 text-[0.8125rem] font-semibold"
          >
            {PERIOD_LABEL[period]}
            <ChevronDown className="h-3.5 w-3.5 text-catdex-gray-light" />
          </button>
        }
      />

      {/* Collection growth */}
      <Card>
        <p className="text-[0.8125rem] text-catdex-text-muted font-medium">Gatos capturados</p>
        <div className="flex items-baseline gap-2.5 mt-1 mb-3">
          <span className="text-[2.25rem] font-bold leading-none tracking-tight">{stats.captured}</span>
          {stats.growth !== null && (
            <span className="inline-flex items-center gap-1 text-[0.75rem] font-bold text-catdex-green bg-catdex-green/10 rounded-full px-2 py-0.5">
              <TrendingUp className="h-3 w-3" />
              {stats.growth >= 0 ? "+" : ""}
              {stats.growth}%
            </span>
          )}
        </div>
        <LineChart values={stats.values} labels={stats.labels} height={110} />
      </Card>

      {/* Streaks */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <span className="w-9 h-9 rounded-xl bg-catdex-orange/10 flex items-center justify-center mb-2.5">
            <Flame className="h-4.5 w-4.5 text-catdex-orange" />
          </span>
          <p className="text-[0.75rem] text-catdex-text-muted font-medium">Racha actual</p>
          <p className="text-xl font-bold mt-0.5">
            {stats.currentStreak} <span className="text-sm font-semibold text-catdex-text-muted">día{stats.currentStreak !== 1 ? "s" : ""}</span>
          </p>
        </Card>
        <Card>
          <span className="w-9 h-9 rounded-xl bg-catdex-orange/10 flex items-center justify-center mb-2.5">
            <Trophy className="h-4.5 w-4.5 text-catdex-orange" />
          </span>
          <p className="text-[0.75rem] text-catdex-text-muted font-medium">Mejor racha</p>
          <p className="text-xl font-bold mt-0.5">
            {stats.bestStreak} <span className="text-sm font-semibold text-catdex-text-muted">día{stats.bestStreak !== 1 ? "s" : ""}</span>
          </p>
        </Card>
      </div>

      {/* Places + favorites */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <p className="text-[0.75rem] text-catdex-text-muted font-medium mb-2.5">Lugares explorados</p>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xl font-bold leading-tight">{stats.places}</p>
              <p className="text-[0.75rem] text-catdex-text-muted">barrio{stats.places !== 1 ? "s" : ""}</p>
            </div>
            <ProgressRing progress={stats.gpsShare} size={52} strokeWidth={6} label={`${Math.round(stats.gpsShare * 100)}%`} />
          </div>
        </Card>
        <Card>
          <p className="text-[0.75rem] text-catdex-text-muted font-medium mb-2.5">Favoritos</p>
          <div className="flex items-end justify-between">
            <p className="text-xl font-bold leading-tight">{favoriteCount}</p>
            <Heart className="h-6 w-6 text-catdex-orange fill-catdex-orange mb-0.5" />
          </div>
        </Card>
      </div>

      {/* Period sheet */}
      <Sheet open={periodSheetOpen} onClose={() => setPeriodSheetOpen(false)}>
        <div className="px-6 pt-2 pb-4">
          <h2 className="text-base font-bold mb-3">Periodo</h2>
          {(Object.keys(PERIOD_LABEL) as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => {
                setPeriod(p);
                setPeriodSheetOpen(false);
              }}
              className={`w-full text-left px-4 py-3.5 rounded-2xl text-[0.9375rem] font-medium transition-colors ${
                period === p ? "bg-catdex-orange/10 text-catdex-orange" : "active:bg-catdex-input-bg"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}
