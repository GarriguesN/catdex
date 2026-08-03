"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Swords, Plus, X, Trophy } from "lucide-react";
import clsx from "clsx";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { isAbortError } from "@/lib/pocketbase";
import { listFriends, type FriendEntry } from "@/lib/friends";
import { getWeeklyRanking, type WeeklyRankEntry } from "@/lib/ranking";
import { listMyDuels, createDuel, cancelDuel, type DuelEntry } from "@/lib/duels";
import { TopBar } from "@/components/ui/TopBar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Sheet } from "@/components/ui/Sheet";
import { FriendAvatar } from "@/components/friends/FriendAvatar";

/**
 * "Competición" — everything competitive (weekly ranking, duels), pulled
 * together in one place reachable from the bottom nav instead of buried
 * inside /friends. Colonia compartida stays in /friends — it's cooperative,
 * not competitive, so it doesn't belong here.
 */
export default function CompetitionPage() {
  const { user } = useRequireAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [weeklyRanking, setWeeklyRanking] = useState<WeeklyRankEntry[]>([]);
  const [duels, setDuels] = useState<DuelEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState("");

  const load = useCallback(async () => {
    try {
      const f = await listFriends().catch(() => []);
      setFriends(f);
      // Single listFriends() now feeds both the friends list and the ranking
      // — getWeeklyRanking accepts the cached list to skip the internal
      // fetch it used to do (Fase 1.5).
      const [ranking, myDuels] = await Promise.all([
        getWeeklyRanking(f).catch(() => []),
        listMyDuels().catch(() => []),
      ]);
      setWeeklyRanking(ranking);
      setDuels(myDuels);
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load competition data:", err);
    }
    setLoading(false);
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

      {loading ? (
        <>
          <div className="skeleton h-40 w-full" />
          <div className="skeleton h-40 w-full" />
        </>
      ) : friends.length === 0 ? (
        <div className="empty-state">
          <Trophy className="h-10 w-10 text-catdex-gray-light mb-3" />
          <p className="font-semibold text-catdex-text">Aún no hay competición</p>
          <p className="text-sm text-catdex-text-muted mt-1.5 max-w-xs text-center">
            Añade amigos para desbloquear el ranking semanal y los duelos
          </p>
          <Link href="/friends" className="btn-primary mt-5">
            Ir a Amigos
          </Link>
        </div>
      ) : (
        <>
          {/* Weekly ranking — friends only, resets Mondays. No divisions/
              promotion, just "who's gained the most this week". */}
          <Card>
            <CardTitle className="mb-3">Ranking semanal</CardTitle>
            {weeklyRanking.length === 0 ? (
              <p className="text-sm text-catdex-text-muted px-1">
                Añade amigos para ver aquí el ranking semanal
              </p>
            ) : weeklyRanking.every((e) => !e.hasSnapshot) ? (
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
            {duels.length === 0 ? (
              <p className="text-sm text-catdex-text-muted px-1">
                {friends.length === 0 ? "Añade amigos para poder retarlos" : "Aún no tienes duelos — reta a un amigo"}
              </p>
            ) : (
              <div className="space-y-3">
                {duels.map((duel) => (
                  <div key={duel.id} className="flex items-center gap-3">
                    <Link href={`/profile/${duel.otherUser.id}`}>
                      <FriendAvatar user={duel.otherUser} className="w-10 h-10 text-sm" />
                    </Link>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        vs. <Link href={`/profile/${duel.otherUser.id}`}>{duel.otherUser.name || "Sin nombre"}</Link>
                      </p>
                      <p className="text-[0.75rem] text-catdex-text-muted">
                        Tú +{duel.myDelta} · {duel.otherUser.name || "Él/ella"} +{duel.theirDelta}
                        {duel.status === "finished"
                          ? duel.outcome === "tie"
                            ? " · Empate"
                            : duel.outcome === "me"
                              ? " · ¡Ganaste!"
                              : " · Perdiste"
                          : ` · vas ${duel.outcome === "me" ? "ganando" : duel.outcome === "them" ? "perdiendo" : "empatado"}`}
                      </p>
                    </div>
                    {duel.status === "active" && (
                      <button
                        aria-label="Cancelar duelo"
                        onClick={() => handleCancelDuel(duel.id)}
                        className="w-9 h-9 rounded-full bg-catdex-input-bg text-catdex-text-muted flex items-center justify-center active:scale-90 transition-transform"
                      >
                        <X className="h-4.5 w-4.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </>
      )}

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
