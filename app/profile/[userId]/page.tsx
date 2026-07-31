"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import { Cat, MapPin, Flame, Building2, ChevronRight } from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { getPocketBase, isAbortError } from "@/lib/pocketbase";
import { formatTimeAgo } from "@/lib/utils";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";
import { rankForScore, highestRarity, RARITY_FRAME_CLASS } from "@/lib/gamification-defs";
import { Card } from "@/components/ui/Card";
import { TopBar } from "@/components/ui/TopBar";
import { AchievementBadge, AchievementCircle } from "@/components/AchievementBadge";

interface ProfileUser {
  id: string;
  name: string;
  avatar: string;
  score: number;
  created: string;
}

interface PhotoRec {
  id: string;
  created: string;
  city?: string;
  cat: string;
  thumb?: string;
  photo?: string;
  expand?: { cat?: { name?: string } };
}

interface AchievementRec {
  id: string;
  badgeCode: string;
  unlockedAt: number;
}

type TimelineItem =
  | { type: "capture"; key: string; date: number; catId: string; catName: string; thumbUrl: string | null; city: string }
  | { type: "milestone"; key: string; date: number; badgeCode: string };

const MILESTONE_COUNTS: Record<string, number> = {
  first_catch: 1,
  collector_10: 10,
  collector_25: 25,
};

/**
 * Read-only mirror of app/profile/page.tsx for viewing a friend's profile —
 * no edit button, no notification bell, no settings link. Reached from
 * /friends, the collection's "Amigos" tab (CatCard discoverer pill), and
 * the cat detail page's "Descubierto por" row.
 */
export default function FriendProfilePage() {
  useRequireAuth();
  const { userId } = useParams<{ userId: string }>();
  const router = useRouter();
  const [profileUser, setProfileUser] = useState<ProfileUser | null>(null);
  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [catCount, setCatCount] = useState(0);
  const [achievements, setAchievements] = useState<AchievementRec[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!userId) return;
    load(userId);
  }, [userId]);

  async function load(id: string) {
    setLoading(true);
    setNotFound(false);
    try {
      const pb = getPocketBase();
      const [userResult, photosResult, catsResult, achievementsResult] = await Promise.all([
        pb.collection("users").getOne(id, { fields: "id,name,avatar,score,created" }),
        pb.collection("photos").getFullList({
          filter: `user="${id}"`,
          sort: "-created",
          expand: "cat",
          fields: "id,created,city,cat,thumb,photo,expand.cat.name",
        }),
        pb.collection("cats").getList(1, 1, { filter: `discoveredBy="${id}"`, fields: "id" }),
        pb
          .collection("achievements")
          .getFullList({ filter: `user="${id}"`, sort: "-unlockedAt" })
          .catch(() => []),
      ]);
      setProfileUser(userResult as unknown as ProfileUser);
      setPhotos(photosResult as unknown as PhotoRec[]);
      setCatCount(catsResult.totalItems);
      setAchievements(achievementsResult as unknown as AchievementRec[]);
    } catch (err) {
      if (!isAbortError(err)) {
        console.error("Failed to load friend profile:", err);
        setNotFound(true);
      }
    }
    setLoading(false);
  }

  const pb = getPocketBase();

  const stats = useMemo(() => {
    const days = new Set(photos.map((p) => new Date(p.created).toDateString()));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const cityCounts = new Map<string, number>();
    for (const p of photos) {
      if (p.city) cityCounts.set(p.city, (cityCounts.get(p.city) || 0) + 1);
    }
    let topCity = "";
    let topCount = 0;
    for (const [city, count] of cityCounts) {
      if (count > topCount) {
        topCity = city;
        topCount = count;
      }
    }

    return { streak, cities: cityCounts.size, topCity };
  }, [photos]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const captureItems: TimelineItem[] = photos.slice(0, 8).map((p) => ({
      type: "capture",
      key: `photo-${p.id}`,
      date: new Date(p.created).getTime(),
      catId: p.cat,
      catName: p.expand?.cat?.name || "Gato",
      thumbUrl: p.photo ? `${pb.baseUrl}/api/files/photos/${p.id}/${p.photo}?thumb=100x100f` : null,
      city: p.city || "",
    }));
    const milestoneItems: TimelineItem[] = achievements.map((a) => ({
      type: "milestone",
      key: `ach-${a.id}`,
      date: a.unlockedAt,
      badgeCode: a.badgeCode,
    }));
    return [...captureItems, ...milestoneItems].sort((a, b) => b.date - a.date).slice(0, 6);
  }, [photos, achievements, pb.baseUrl]);

  const recentAchievements = achievements.slice(0, 4);

  if (loading) {
    return (
      <div className="pt-3 space-y-4">
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-56 w-full" />
        <div className="skeleton h-36 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  if (notFound || !profileUser) {
    return (
      <div className="empty-state">
        <p className="text-4xl mb-4">😿</p>
        <p className="font-semibold text-catdex-text">Perfil no encontrado</p>
        <button onClick={() => router.back()} className="btn-primary mt-5">
          Volver
        </button>
      </div>
    );
  }

  const name = profileUser.name || "Sin nombre";
  const initial = (name[0] || "?").toUpperCase();
  const avatarUrl = profileUser.avatar && `${pb.baseUrl}/api/files/users/${profileUser.id}/${profileUser.avatar}?thumb=200x200`;
  const collectingSince = profileUser.created
    ? new Date(profileUser.created).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";
  const rank = rankForScore(profileUser.score || 0);
  const avatarFrameClass =
    RARITY_FRAME_CLASS[highestRarity(achievements.map((a) => a.badgeCode), ACHIEVEMENT_DEFS) || ""] || "";

  return (
    <div className="pt-3 space-y-4">
      <TopBar back title="Perfil" />

      <section className="flex flex-col items-center text-center animate-fade-up">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt="" className={clsx("w-28 h-28 rounded-full object-cover", avatarFrameClass)} />
        ) : (
          <span
            className={clsx(
              "w-28 h-28 rounded-full bg-catdex-orange/15 text-catdex-orange text-4xl font-bold flex items-center justify-center",
              avatarFrameClass
            )}
          >
            {initial}
          </span>
        )}
        <h2 className="text-[1.5rem] font-bold tracking-tight mt-3">{name}</h2>
        <span className="text-[0.75rem] font-bold text-catdex-orange bg-catdex-orange/10 rounded-full px-2.5 py-0.5 mt-1">
          {rank.name}
        </span>
        {collectingSince && (
          <p className="text-[0.8125rem] text-catdex-text-muted mt-1">Collecting since {collectingSince}</p>
        )}
      </section>

      <Card>
        <h3 className="text-[0.9375rem] font-semibold mb-3">Resumen de su colección</h3>
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {[
            { icon: Cat, value: String(catCount), label: "Gatos capturados" },
            { icon: MapPin, value: String(stats.cities), label: "Ciudades exploradas" },
            { icon: Flame, value: String(stats.streak), label: "Días de racha" },
            { icon: Building2, value: stats.topCity || "—", label: "Ciudad más explorada" },
          ].map(({ icon: Icon, value, label }) => (
            <div
              key={label}
              className="w-[5.75rem] shrink-0 border border-catdex-hairline rounded-2xl px-2 py-3 flex flex-col items-center text-center gap-1.5"
            >
              <Icon className="h-5 w-5 text-catdex-orange" strokeWidth={2} />
              <p className="text-[1.0625rem] font-bold leading-tight truncate max-w-full">{value}</p>
              <p className="text-[0.625rem] text-catdex-text-muted leading-tight">{label}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-[0.9375rem] font-semibold mb-3">Logros recientes</h3>
        {recentAchievements.length === 0 ? (
          <p className="text-sm text-catdex-text-muted px-1">Aún no ha desbloqueado logros</p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {recentAchievements.map((a) => (
              <AchievementBadge key={a.id} badgeCode={a.badgeCode} unlockedAt={a.unlockedAt} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-[0.9375rem] font-semibold mb-3">Actividad reciente</h3>
        {timeline.length === 0 ? (
          <p className="text-sm text-catdex-text-muted px-1">Sus capturas y logros aparecerán aquí</p>
        ) : (
          <div className="relative">
            <span className="absolute left-[5px] top-3 bottom-3 w-0.5 bg-catdex-orange/25" aria-hidden="true" />
            <div className="space-y-4">
              {timeline.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full bg-catdex-orange shrink-0 relative z-10 border-2 border-catdex-surface" />
                  {item.type === "capture" ? (
                    <Link href={`/cat?id=${item.catId}`} className="flex items-center gap-3 flex-1 min-w-0">
                      {item.thumbUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbUrl} alt="" className="w-10 h-10 rounded-full object-cover shrink-0" />
                      ) : (
                        <span className="w-10 h-10 rounded-full bg-catdex-input-bg flex items-center justify-center shrink-0">
                          🐾
                        </span>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">Capturó &quot;{item.catName}&quot;</p>
                        <p className="text-[0.75rem] text-catdex-text-muted mt-0.5">
                          {formatTimeAgo(item.date)}
                          {item.city ? ` · ${item.city}` : ""}
                        </p>
                      </div>
                      {item.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded-xl bg-catdex-input-bg object-contain shrink-0" />
                      )}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {MILESTONE_COUNTS[item.badgeCode] ? (
                        <span className="w-11 h-11 rounded-full border-2 border-catdex-orange text-catdex-orange font-bold text-sm flex items-center justify-center shrink-0">
                          {MILESTONE_COUNTS[item.badgeCode]}
                        </span>
                      ) : (
                        <AchievementCircle badgeCode={item.badgeCode} className="w-11 h-11" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {MILESTONE_COUNTS[item.badgeCode]
                            ? `¡Alcanzó ${MILESTONE_COUNTS[item.badgeCode]} gato${MILESTONE_COUNTS[item.badgeCode] !== 1 ? "s" : ""}!`
                            : `¡Logro: ${ACHIEVEMENT_DEFS[item.badgeCode]?.name || item.badgeCode}!`}
                        </p>
                        <p className="text-[0.75rem] text-catdex-text-muted mt-0.5">{formatTimeAgo(item.date)}</p>
                      </div>
                      <ChevronRight className="h-4.5 w-4.5 text-catdex-gray-light shrink-0" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
