"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Plus, X, Trophy, Globe, Timer } from "lucide-react";
import clsx from "clsx";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { listFriends, type FriendEntry } from "@/lib/friends";
import {
  getWeeklyRanking,
  getGlobalRanking,
  getMyGlobalRank,
  type WeeklyRankEntry,
  type GlobalRankEntry,
  type GlobalRankPosition,
} from "@/lib/ranking";
import { listMyDuels, createDuel, cancelDuel, type DuelEntry } from "@/lib/duels";
import { TopBar } from "@/components/ui/TopBar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { Podium } from "@/components/ui/Podium";
import { WeekHeader, MetaBand } from "@/components/ui/MetaBand";
import { FriendAvatar } from "@/components/friends/FriendAvatar";

/**
 * "Competición" — global ranking (podium), weekly friends ranking, and duels.
 * The global ranking is the primary block — even users with no friends see it
 * (Fase 2.3). The weekly ranking of friends is secondary, visible only when
 * the user has at least one friend. Duels stay here. Colonia compartida stays
 * in /friends — it's cooperative, not competitive.
 */
export default function CompetitionPage() {
  const { user } = useRequireAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [weeklyRanking, setWeeklyRanking] = useState<WeeklyRankEntry[]>([]);
  const [globalTop, setGlobalTop] = useState<GlobalRankEntry[]>([]);
  const [myPosition, setMyPosition] = useState<GlobalRankPosition | null>(null);
  const [duels, setDuels] = useState<DuelEntry[]>([]);
  // Per-section loading (Fase 2.1) — each section paints its own skeleton
  // so the slowest query doesn't block the fastest from rendering.
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingWeekly, setLoadingWeekly] = useState(true);
  const [loadingDuels, setLoadingDuels] = useState(true);

  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState("");

  const load = useCallback(async () => {
    // Fire all queries in parallel; each one flips its own loading flag
    // when it resolves (independently of the others).
    listFriends()
      .then(setFriends)
      .catch(() => setFriends([]));

    getGlobalRanking(20)
      .then((top) => {
        setGlobalTop(top);
        setLoadingGlobal(false);
      })
      .catch(() => {
        setGlobalTop([]);
        setLoadingGlobal(false);
      });

    getMyGlobalRank()
      .then(setMyPosition)
      .catch(() => setMyPosition(null));

    listMyDuels()
      .then((d) => {
        setDuels(d);
        setLoadingDuels(false);
      })
      .catch(() => {
        setDuels([]);
        setLoadingDuels(false);
      });

    // Weekly ranking depends on friends (uses cached list to skip its own
    // fetch). Wait for friends first, then load.
    listFriends()
      .then((f) => {
        getWeeklyRanking(f)
          .then(setWeeklyRanking)
          .catch(() => setWeeklyRanking([]))
          .finally(() => setLoadingWeekly(false));
      })
      .catch(() => setLoadingWeekly(false));
  }, []);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useRefetchOnFocus(load);

  async function handleChallenge(friendId: string) {
    setChallenging(friendId);
    setChallengeError("");
    try {
      await createDuel(friendId);
      setChallengeOpen(false);
      await load();
    } catch (err) {
      setChallengeError((err as { message?: string })?.message || "No se ha podido crear el duelo.");
    }
    setChallenging(null);
  }

  async function handleCancelDuel(duelId: string) {
    try {
      await cancelDuel(duelId);
      load();
    } catch (err) {
      console.error("Failed to cancel duel:", err);
    }
  }

  const activeDuelFriendIds = new Set(
    duels.filter((d) => d.status === "active").map((d) => d.otherUser.id)
  );

  return (
    <div className="space-y-4">
      <TopBar title="Competición" />

      {/* Fase 2.2 — chip de cabecera con contexto temporal (semana + días) */}
      <WeekHeader />

      {/* Fase 2.6 — banda de metadatos de competición (W/L + mejor semana + ratio) */}
      <MetaBand
        wins={duels.filter((d) => d.status === "finished" && d.outcome === "me").length}
        losses={duels.filter((d) => d.status === "finished" && d.outcome === "them").length}
        ties={duels.filter((d) => d.status === "finished" && d.outcome === "tie").length}
        bestWeekScore={Math.max(0, ...weeklyRanking.map((e) => e.weeklyScore))}
      />

      {/* Global podium — primary block. Visible even with zero friends. */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Ranking global</CardTitle>
          <span className="text-[0.6875rem] uppercase tracking-wide text-catdex-text-muted font-semibold inline-flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Todos
          </span>
        </div>
        {loadingGlobal ? (
          <div className="skeleton h-28 w-full" />
        ) : globalTop.length > 0 ? (
          <>
            <Podium top={globalTop} />
            {myPosition && myPosition.rank > 3 && (
              <MyPositionCard pos={myPosition} />
            )}
          </>
        ) : (
          <p className="text-sm text-catdex-text-muted px-1 py-6 text-center">
            Aún no hay nadie en el ranking global.
          </p>
        )}
      </Card>

      {/* Weekly friends ranking — secondary. No podium here (per plan:
          with 3-6 participants a 1-2-3 doesn't add signal; compact list). */}
      {friends.length === 0 && !loadingWeekly ? (
        <Card>
          <CardTitle className="mb-3">Ranking semanal</CardTitle>
          <p className="text-sm text-catdex-text-muted px-1">
            Añade amigos para ver aquí el ranking semanal
          </p>
          <Link href="/friends" className="btn-secondary mt-4 w-full inline-flex items-center justify-center gap-2">
            <Trophy className="h-4 w-4" />
            Ir a Amigos
          </Link>
        </Card>
      ) : loadingWeekly ? (
        <Card>
          <CardTitle className="mb-3">Ranking semanal</CardTitle>
          <div className="skeleton h-32 w-full" />
        </Card>
      ) : (
        <Card>
          <CardTitle className="mb-3">Ranking semanal</CardTitle>
          {weeklyRanking.every((e) => !e.hasSnapshot) ? (
            // No snapshot yet for anyone this week — show the prep message
            // instead of a list of zeros that would look like the app is
            // broken. With Fase 1.1 (auto-reparable daily cron) this only
            // happens in the first ~5 min after Monday 00:00 UTC.
            <p className="text-sm text-catdex-text-muted px-1">
              Ranking en preparación · empieza el lunes
            </p>
          ) : (
            <div className="space-y-2.5">
              {weeklyRanking.map((entry, i) => (
                <div key={entry.userId} className="flex items-center gap-3">
                  <span className="w-6 text-sm font-bold text-catdex-text-muted text-center shrink-0">
                    {i + 1}
                  </span>
                  {entry.isMe ? (
                    <FriendAvatar user={{ id: entry.userId, name: entry.name, avatar: entry.avatar }} className="w-9 h-9 text-sm" />
                  ) : (
                    <Link href={`/profile/${entry.userId}`}>
                      <FriendAvatar user={{ id: entry.userId, name: entry.name, avatar: entry.avatar }} className="w-9 h-9 text-sm" />
                    </Link>
                  )}
                  <p className={clsx("flex-1 min-w-0 text-sm truncate", entry.isMe ? "font-bold" : "font-semibold")}>
                    {entry.isMe ? "Tú" : entry.name || "Sin nombre"}
                  </p>
                  <span className="text-sm font-bold text-catdex-orange">+{entry.weeklyScore}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* Duels */}
      <Card>
        <div className="flex items-center justify-between mb-3">
          <CardTitle>Duelos</CardTitle>
          <button
            onClick={() => setChallengeOpen(true)}
            disabled={friends.length === 0}
            className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-catdex-orange disabled:opacity-40"
          >
            <Plus className="h-4 w-4" />
            Retar
          </button>
        </div>
        {loadingDuels ? (
          <div className="skeleton h-24 w-full" />
        ) : duels.length === 0 ? (
          // Fase 2.5 — empty state con sugerencia: amigo sin duelo activo con más
          // score semanal. Si no hay candidatos, copy genérico.
          <DuelEmptyState friends={friends} weeklyRanking={weeklyRanking} />
        ) : (
          <div className="space-y-3">
            {duels.map((duel) => (
              <DuelRow key={duel.id} duel={duel} onCancel={handleCancelDuel} />
            ))}
          </div>
        )}
      </Card>

      {/* Challenge sheet — pick a friend without an active duel already */}
      <Sheet open={challengeOpen} onClose={() => setChallengeOpen(false)}>
        <div className="px-6 pt-2 pb-4">
          <h2 className="text-base font-bold mb-1">Retar a un duelo</h2>
          <p className="text-[0.8125rem] text-catdex-text-muted mb-4">Quien más puntos gane en 7 días, gana</p>
          {challengeError && <p className="text-[0.8125rem] text-catdex-red mb-3">{challengeError}</p>}
          <div className="space-y-2">
            {friends.map((f) => {
              const hasActive = activeDuelFriendIds.has(f.friend.id);
              return (
                <button
                  key={f.friendshipId}
                  onClick={() => !hasActive && handleChallenge(f.friend.id)}
                  disabled={hasActive || challenging === f.friend.id}
                  className="w-full flex items-center gap-3 px-2 py-2 rounded-2xl active:bg-catdex-input-bg disabled:opacity-40 transition-colors"
                >
                  <FriendAvatar user={f.friend} className="w-11 h-11 text-base" />
                  <span className="flex-1 text-left text-sm font-semibold truncate">{f.friend.name || "Sin nombre"}</span>
                  {hasActive ? (
                    <span className="text-[0.75rem] text-catdex-text-muted">Ya en duelo</span>
                  ) : (
                    <Swords className="h-4.5 w-4.5 text-catdex-orange shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/** Compact "your position" row that sits below the podium when you're
 *  not in the top-3. Pulled out to keep the parent readable. */
function MyPositionCard({ pos }: { pos: GlobalRankPosition }) {
  // "Puesto 47 de 210 · a 120 pts del 46"
  // Plan: if top-10 → show distance to podium; else → distance to #above.
  const showDistance = pos.nextScore != null && pos.nextScore > pos.score;
  const distance = showDistance ? pos.nextScore! - pos.score : 0;
  const distanceTarget = pos.rank <= 10 ? "del podio" : `del ${pos.rank - 1}º`;

  return (
    <div className="mt-3 px-3 py-2.5 rounded-2xl bg-catdex-input-bg flex items-center justify-between">
      <div>
        <p className="text-[0.6875rem] uppercase tracking-wide text-catdex-text-muted font-semibold">
          Tu puesto
        </p>
        <p className="text-base font-bold text-catdex-text">
          {pos.rank} <span className="text-[0.8125rem] font-normal text-catdex-text-muted">de {pos.total}</span>
        </p>
      </div>
      {showDistance && (
        <p className="text-[0.8125rem] text-catdex-text-secondary">
          a <span className="font-bold text-catdex-orange">{distance}</span> pts {distanceTarget}
        </p>
      )}
    </div>
  );
}

/** Single duel row (Fase 2.5): shared progress bar (me orange / rival gris),
 *  real countdown to endsAt, status label. Pulled out to keep the parent
 *  readable and to localize the countdown math here. */
function DuelRow({ duel, onCancel }: { duel: DuelEntry; onCancel: (id: string) => void }) {
  const total = duel.myDelta + duel.theirDelta;
  const myPct = total === 0 ? 50 : Math.round((duel.myDelta / total) * 100);
  const theirsPct = 100 - myPct;
  const endsAtMs = new Date(duel.endsAt).getTime();
  const nowMs = Date.now();
  const remaining = endsAtMs - nowMs;
  const daysLeft = Math.max(0, Math.ceil(remaining / 86400000));
  const hoursLeft = Math.max(0, Math.ceil(remaining / 3600000));
  const countdown = remaining <= 0
    ? "Finalizado"
    : daysLeft > 1
      ? `${daysLeft} días`
      : hoursLeft > 1
        ? `${hoursLeft} h`
        : "menos de 1 h";

  const outcomeLabel =
    duel.outcome === "tie" ? "Empate"
      : duel.outcome === "me" ? "¡Ganaste!"
        : "Perdiste";

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${duel.otherUser.id}`}>
          <FriendAvatar user={duel.otherUser} className="w-10 h-10 text-sm" />
        </Link>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">
            vs. <Link href={`/profile/${duel.otherUser.id}`}>{duel.otherUser.name || "Sin nombre"}</Link>
          </p>
          <p className="text-[0.75rem] text-catdex-text-muted inline-flex items-center gap-1.5">
            <span>Tú +{duel.myDelta} · {duel.otherUser.name || "Él/ella"} +{duel.theirDelta}</span>
            {duel.status === "active" ? (
              <>
                <span className="opacity-60">·</span>
                <Timer className="h-3 w-3" />
                <span>{countdown}</span>
              </>
            ) : (
              <>
                <span className="opacity-60">·</span>
                <span className={clsx("font-semibold",
                  duel.outcome === "me" ? "text-catdex-orange" : "text-catdex-text")}>
                  {outcomeLabel}
                </span>
              </>
            )}
          </p>
        </div>
        {duel.status === "active" && (
          <button
            aria-label="Cancelar duelo"
            onClick={() => onCancel(duel.id)}
            className="w-9 h-9 rounded-full bg-catdex-input-bg text-catdex-text-muted flex items-center justify-center active:scale-90 transition-transform"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        )}
      </div>
      {/* Shared progress bar: my % in orange, theirs % in catdex-input-bg */}
      <div className="h-1.5 rounded-full overflow-hidden flex bg-catdex-input-bg">
        <div
          className="bg-catdex-orange transition-all"
          style={{ width: `${myPct}%` }}
          title={`Tú ${myPct}%`}
        />
        <div
          className="bg-catdex-text-muted/40 transition-all"
          style={{ width: `${theirsPct}%` }}
          title={`${duel.otherUser.name || "Rival"} ${theirsPct}%`}
        />
      </div>
    </div>
  );
}

/** Fase 2.5 empty state — if the user has at least one friend without an
 *  active duel, suggest the friend with the highest weekly score. Otherwise
 *  fall back to a generic copy. */
function DuelEmptyState({ friends, weeklyRanking }: {
  friends: FriendEntry[];
  weeklyRanking: WeeklyRankEntry[];
}) {
  // Find a friend to suggest — we use the weekly ranking's weeklyScore to
  // pick the strongest challenger. The actual filter "no active duel" lives
  // in the Sheet (activeDuelFriendIds). Here we just propose a name.
  const friendScores = new Map(weeklyRanking.map((e) => [e.userId, e.weeklyScore]));
  const candidates = [...friends]
    .sort((a, b) => (friendScores.get(b.friend.id) ?? 0) - (friendScores.get(a.friend.id) ?? 0));
  const suggested = candidates[0];

  if (friends.length === 0) {
    return (
      <p className="text-sm text-catdex-text-muted px-1">
        Añade amigos para poder retarlos
      </p>
    );
  }
  if (!suggested) {
    return (
      <p className="text-sm text-catdex-text-muted px-1">
        Aún no tienes duelos — reta a un amigo
      </p>
    );
  }
  // The suggestion is visual only — the actual "Retar" button opens the
  // Sheet, which itself filters out friends with active duels.
  return (
    <div className="flex items-center gap-3 opacity-80">
      <FriendAvatar user={suggested.friend} className="w-9 h-9 text-sm grayscale" />
      <p className="text-[0.8125rem] text-catdex-text-muted flex-1 min-w-0 truncate">
        Retar a <span className="font-semibold text-catdex-text">{suggested.friend.name || "Sin nombre"}</span>
        {" "}— el más activo de tus amigos esta semana
      </p>
    </div>
  );
}
