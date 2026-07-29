"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Calendar,
  Cat,
  Heart,
  MapPin,
  Flame,
  Building2,
  Pencil,
  Plus,
  ChevronRight,
  UserPlus,
} from "lucide-react";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { getPocketBase } from "@/lib/pocketbase";
import { getFavorites } from "@/lib/favorites";
import { formatTimeAgo } from "@/lib/utils";
import { ACHIEVEMENT_DEFS } from "@/lib/achievements-defs";
import { listFriends, listPendingIncoming, countFriendCats, type FriendEntry } from "@/lib/friends";
import { Card } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { AchievementBadge, AchievementCircle } from "@/components/AchievementBadge";
import { FriendAvatar } from "@/components/friends/FriendAvatar";
import { IncomingRequests } from "@/components/friends/IncomingRequests";
import { EditProfileSheet } from "@/components/profile/EditProfileSheet";

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

/** Badges whose milestone is a cat-count — rendered as the big number circle. */
const MILESTONE_COUNTS: Record<string, number> = {
  first_catch: 1,
  collector_10: 10,
  collector_25: 25,
};

function SectionHeader({ title, href }: { title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-[0.9375rem] font-semibold">{title}</h3>
      {href && (
        <Link href={href} className="text-[0.8125rem] font-semibold text-catdex-orange">
          Ver todos
        </Link>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useRequireAuth();
  const [photos, setPhotos] = useState<PhotoRec[]>([]);
  const [catCount, setCatCount] = useState(0);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [achievements, setAchievements] = useState<AchievementRec[]>([]);
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [friendCatCounts, setFriendCatCounts] = useState<Record<string, number>>({});
  const [pendingIncoming, setPendingIncoming] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [bellOpen, setBellOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const loadFriendsAndRequests = useCallback(async () => {
    try {
      const [f, incoming] = await Promise.all([listFriends(), listPendingIncoming()]);
      setFriends(f);
      setPendingIncoming(incoming);
      const counts = await Promise.all(f.map((e) => countFriendCats(e.friend.id)));
      setFriendCatCounts(Object.fromEntries(f.map((e, i) => [e.friend.id, counts[i]])));
    } catch (err) {
      // friendships collection may not exist yet (backend not migrated) —
      // the profile still renders without the social bits
      console.error("Failed to load friends:", err);
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    setFavoriteCount(getFavorites().size);

    async function load() {
      const pb = getPocketBase();
      const userId = pb.authStore.record?.id;
      try {
        const [photosResult, catsResult, achievementsResult] = await Promise.all([
          pb.collection("photos").getFullList({
            filter: `user="${userId}"`,
            sort: "-created",
            expand: "cat",
            fields: "id,created,city,cat,thumb,photo,expand.cat.name",
          }),
          pb.collection("cats").getList(1, 1, { filter: `discoveredBy="${userId}"`, fields: "id" }),
          pb
            .collection("achievements")
            .getFullList({ filter: `user="${userId}"`, sort: "-unlockedAt" })
            .catch(() => []),
        ]);
        setPhotos(photosResult as unknown as PhotoRec[]);
        setCatCount(catsResult.totalItems);
        setAchievements(achievementsResult as unknown as AchievementRec[]);
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
      setLoading(false);
    }

    load();
    loadFriendsAndRequests();
  }, [user, loadFriendsAndRequests]);

  // Friend requests/accepts made from another device won't push here —
  // catch up whenever the user comes back to this tab.
  useRefetchOnFocus(loadFriendsAndRequests);

  const pb = getPocketBase();

  const stats = useMemo(() => {
    // Streak — consecutive days with at least one photo (same as /profile/stats)
    const days = new Set(photos.map((p) => new Date(p.created).toDateString()));
    let streak = 0;
    const cursor = new Date();
    if (!days.has(cursor.toDateString())) cursor.setDate(cursor.getDate() - 1);
    while (days.has(cursor.toDateString())) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    // Cities — only photos with a geocoded city (pre-migration photos have none)
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
      thumbUrl:
        p.thumb || p.photo
          ? `${pb.baseUrl}/api/files/photos/${p.id}/${p.thumb || p.photo}?thumb=100x100`
          : null,
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

  const name = user?.name || user?.email?.split("@")[0] || "";
  const initial = (name[0] || "?").toUpperCase();
  const avatarUrl =
    user?.avatar && `${pb.baseUrl}/api/files/users/${user.id}/${user.avatar}?thumb=200x200`;
  const collectingSince = user?.created
    ? new Date(user.created).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    : "";

  if (!user || loading) {
    return (
      <div className="pt-3 space-y-4">
        <div className="skeleton h-10 w-32" />
        <div className="skeleton h-56 w-full" />
        <div className="skeleton h-36 w-full" />
        <div className="skeleton h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="pt-3 space-y-4">
      {/* Header — title left, notification bell right with unread dot */}
      <header className="flex items-center justify-between pb-1">
        <h1 className="text-[1.375rem] font-bold tracking-tight">Perfil</h1>
        <button
          aria-label="Notificaciones"
          onClick={() => {
            setBellOpen(true);
            loadFriendsAndRequests();
          }}
          className="relative w-10 h-10 rounded-full flex items-center justify-center text-catdex-text active:scale-90 transition-transform"
        >
          <Bell className="h-6 w-6" strokeWidth={1.8} />
          {pendingIncoming.length > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 rounded-full bg-catdex-orange border-2 border-catdex-cream" />
          )}
        </button>
      </header>

      {/* Profile section — avatar with floating edit button, name, since, CTA */}
      <section className="flex flex-col items-center text-center animate-fade-up">
        <button
          onClick={() => setEditOpen(true)}
          aria-label="Editar perfil"
          className="relative active:scale-95 transition-transform"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt="" className="w-28 h-28 rounded-full object-cover" />
          ) : (
            <span className="w-28 h-28 rounded-full bg-catdex-orange/15 text-catdex-orange text-4xl font-bold flex items-center justify-center">
              {initial}
            </span>
          )}
          <span className="absolute bottom-0.5 -right-1 w-9 h-9 rounded-full bg-catdex-orange text-white flex items-center justify-center border-[3px] border-catdex-cream">
            <Pencil className="h-4 w-4" />
          </span>
        </button>
        <h2 className="text-[1.5rem] font-bold tracking-tight mt-3">{name || "Sin nombre"}</h2>
        {collectingSince && (
          <p className="inline-flex items-center gap-1.5 text-[0.8125rem] text-catdex-text-muted mt-1">
            <Calendar className="h-3.5 w-3.5" />
            Collecting since {collectingSince}
          </p>
        )}
        <button onClick={() => setEditOpen(true)} className="btn-primary w-full mt-4">
          Editar perfil
        </button>
      </section>

      {/* Collection summary — five stat tiles */}
      <Card>
        <SectionHeader title="Resumen de tu colección" href="/profile/stats" />
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar -mx-1 px-1">
          {[
            { icon: Cat, value: String(catCount), label: "Gatos capturados" },
            { icon: Heart, value: String(favoriteCount), label: "Favoritos" },
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

      {/* Recent achievements */}
      <Card>
        <SectionHeader title="Logros recientes" href="/profile/achievements" />
        {recentAchievements.length === 0 ? (
          <p className="text-sm text-catdex-text-muted px-1">
            Captura gatos para desbloquear tus primeros logros
          </p>
        ) : (
          <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
            {recentAchievements.map((a) => (
              <Link key={a.id} href="/profile/achievements">
                <AchievementBadge badgeCode={a.badgeCode} unlockedAt={a.unlockedAt} />
              </Link>
            ))}
          </div>
        )}
      </Card>

      {/* Recent activity timeline */}
      <Card>
        <SectionHeader title="Actividad reciente" />
        {timeline.length === 0 ? (
          <p className="text-sm text-catdex-text-muted px-1">
            Tus capturas y logros aparecerán aquí
          </p>
        ) : (
          <div className="relative">
            {/* Timeline line */}
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
                        <p className="text-sm font-semibold truncate">
                          Capturaste “{item.catName}”
                        </p>
                        <p className="text-[0.75rem] text-catdex-text-muted mt-0.5">
                          {formatTimeAgo(item.date)}
                          {item.city ? ` · ${item.city}` : ""}
                        </p>
                      </div>
                      {item.thumbUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.thumbUrl} alt="" className="w-12 h-12 rounded-xl object-cover shrink-0" />
                      )}
                    </Link>
                  ) : (
                    <Link href="/profile/achievements" className="flex items-center gap-3 flex-1 min-w-0">
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
                            ? `¡Has alcanzado ${MILESTONE_COUNTS[item.badgeCode]} gato${MILESTONE_COUNTS[item.badgeCode] !== 1 ? "s" : ""}!`
                            : `¡Logro: ${ACHIEVEMENT_DEFS[item.badgeCode]?.name || item.badgeCode}!`}
                        </p>
                        <p className="text-[0.75rem] text-catdex-text-muted mt-0.5">
                          {formatTimeAgo(item.date)}
                        </p>
                      </div>
                      <ChevronRight className="h-4.5 w-4.5 text-catdex-gray-light shrink-0" />
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </Card>

      {/* Friends */}
      <Card>
        <SectionHeader title="Amigos" href="/friends" />
        <p className="text-[0.8125rem] text-catdex-text-muted -mt-2 mb-3.5">
          Comparte tu pasión por los gatos 🐾
        </p>
        <div className="flex gap-4 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
          <Link href="/friends" className="flex flex-col items-center gap-1.5 w-16 shrink-0">
            <span className="w-14 h-14 rounded-full border-2 border-dashed border-catdex-gray-light/60 text-catdex-gray-light flex items-center justify-center">
              <Plus className="h-6 w-6" />
            </span>
            <span className="text-[0.6875rem] text-catdex-text-muted leading-tight text-center">
              Añadir amigo
            </span>
          </Link>
          {friends.map((e) => (
            <div key={e.friendshipId} className="flex flex-col items-center gap-1.5 w-16 shrink-0">
              <FriendAvatar user={e.friend} className="w-14 h-14 text-lg" />
              <span className="text-[0.6875rem] font-semibold leading-tight text-center truncate max-w-full">
                {e.friend.name || "Sin nombre"}
              </span>
              {friendCatCounts[e.friend.id] != null && (
                <span className="text-[0.625rem] text-catdex-text-muted leading-none -mt-0.5">
                  {friendCatCounts[e.friend.id]} gatos
                </span>
              )}
            </div>
          ))}
        </div>
        <Link
          href="/friends"
          className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-catdex-orange text-catdex-orange font-semibold text-[0.9375rem] py-3 active:bg-catdex-orange/10 transition-colors"
        >
          <UserPlus className="h-4.5 w-4.5" />
          Buscar amigos
        </Link>
      </Card>

      {/* Notification bell sheet — reuses the incoming-requests UI from /friends */}
      <Sheet open={bellOpen} onClose={() => setBellOpen(false)}>
        <div className="px-6 pt-2 pb-4">
          <h2 className="text-base font-bold mb-3">Solicitudes de amistad</h2>
          <IncomingRequests entries={pendingIncoming} onChanged={loadFriendsAndRequests} />
        </div>
      </Sheet>

      <EditProfileSheet open={editOpen} onClose={() => setEditOpen(false)} user={user} />
    </div>
  );
}
