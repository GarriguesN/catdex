"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, Check, UserPlus, Trash2, X, RefreshCw, Swords } from "lucide-react";
import clsx from "clsx";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { useRefetchOnFocus } from "@/hooks/useRefetchOnFocus";
import { isAbortError } from "@/lib/pocketbase";
import { IconButton } from "@/components/ui/IconButton";
import {
  getMyInviteCode,
  resolveInviteCode,
  sendFriendRequest,
  declineRequest,
  removeFriend,
  listFriends,
  listPendingIncoming,
  listPendingOutgoing,
  getRelationshipStatus,
  type FriendEntry,
  type FriendUser,
} from "@/lib/friends";
import { getWeeklyRanking, type WeeklyRankEntry } from "@/lib/ranking";
import { listMyDuels, createDuel, cancelDuel, type DuelEntry } from "@/lib/duels";
import { TopBar } from "@/components/ui/TopBar";
import { Card, CardTitle } from "@/components/ui/Card";
import { Sheet, ConfirmDialog } from "@/components/ui/Sheet";
import { FriendAvatar } from "@/components/friends/FriendAvatar";
import { IncomingRequests } from "@/components/friends/IncomingRequests";

export default function FriendsPage() {
  const { user } = useRequireAuth();
  const [friends, setFriends] = useState<FriendEntry[]>([]);
  const [incoming, setIncoming] = useState<FriendEntry[]>([]);
  const [outgoing, setOutgoing] = useState<FriendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Add-friend flow
  const [addOpen, setAddOpen] = useState(false);
  const [codeInput, setCodeInput] = useState("");
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState("");
  const [preview, setPreview] = useState<FriendUser | null>(null);
  const [sending, setSending] = useState(false);
  const [copied, setCopied] = useState(false);

  const [toRemove, setToRemove] = useState<FriendEntry | null>(null);
  const [weeklyRanking, setWeeklyRanking] = useState<WeeklyRankEntry[]>([]);
  const [duels, setDuels] = useState<DuelEntry[]>([]);
  const [challenging, setChallenging] = useState<string | null>(null);
  const [challengeError, setChallengeError] = useState("");

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [f, inc, out] = await Promise.all([
        listFriends(),
        listPendingIncoming(),
        listPendingOutgoing(),
      ]);
      setFriends(f);
      setIncoming(inc);
      setOutgoing(out);
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load friendships:", err);
    }
    // Independent try/catches — a ranking/duels hiccup shouldn't hide the
    // core friends list, which just loaded successfully above.
    try {
      setWeeklyRanking(await getWeeklyRanking());
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load weekly ranking:", err);
    }
    try {
      setDuels(await listMyDuels());
    } catch (err) {
      if (!isAbortError(err)) console.error("Failed to load duels:", err);
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  async function handleChallenge(friendId: string) {
    setChallenging(friendId);
    setChallengeError("");
    try {
      await createDuel(friendId);
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

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  // Requests/accepts made from the other person's device won't push to this
  // tab — catch up whenever the user comes back to it.
  useRefetchOnFocus(load);

  const myCode = getMyInviteCode();

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(myCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — the code is still visible to copy by hand
    }
  }

  async function handleResolve() {
    if (!codeInput.trim()) return;
    setResolving(true);
    setResolveError("");
    try {
      const found = await resolveInviteCode(codeInput);
      setPreview(found);
    } catch {
      setResolveError("Código no válido. Revísalo e inténtalo de nuevo.");
    }
    setResolving(false);
  }

  async function handleSendRequest() {
    if (!preview) return;
    setSending(true);
    try {
      await sendFriendRequest(preview.id);
      closeAdd();
      load();
    } catch (err) {
      console.error("Failed to send request:", err);
      // The backend rejects duplicates (pb_hooks/friendships.pb.js) without
      // saying which direction the existing row is in — look it up so the
      // user knows exactly where to find it instead of a generic "already
      // friends?" that may not even be true.
      const status = await getRelationshipStatus(preview.id).catch(() => "none");
      if (status === "friends") {
        setResolveError("Ya sois amigos.");
      } else if (status === "incoming") {
        setResolveError('Ya te había enviado una solicitud — acéptala en "Solicitudes recibidas".');
      } else if (status === "outgoing") {
        setResolveError("Ya le enviaste una solicitud — está pendiente de que la acepte.");
      } else {
        setResolveError("No se ha podido enviar la solicitud. Inténtalo de nuevo.");
      }
      setPreview(null);
      load();
    }
    setSending(false);
  }

  function closeAdd() {
    setAddOpen(false);
    setCodeInput("");
    setPreview(null);
    setResolveError("");
  }

  async function handleCancelOutgoing(entry: FriendEntry) {
    try {
      await declineRequest(entry.friendshipId);
      load();
    } catch (err) {
      console.error("Failed to cancel request:", err);
    }
  }

  async function handleRemoveFriend() {
    if (!toRemove) return;
    try {
      await removeFriend(toRemove.friendshipId);
      setToRemove(null);
      load();
    } catch (err) {
      console.error("Failed to remove friend:", err);
      setToRemove(null);
    }
  }

  return (
    <div className="space-y-4">
      <TopBar
        back
        backHref="/profile"
        title="Amigos"
        actions={
          <IconButton label="Actualizar" onClick={load} disabled={refreshing}>
            <RefreshCw className={clsx("h-[19px] w-[19px]", refreshing && "animate-spin")} />
          </IconButton>
        }
      />

      {/* Invite code + add friend */}
      <Card>
        <CardTitle>Tu código de invitación</CardTitle>
        <p className="text-[0.8125rem] text-catdex-text-muted mt-1">
          Compártelo para que te añadan como amigo
        </p>
        <div className="flex items-center gap-2.5 mt-3">
          <span className="flex-1 font-mono text-lg font-bold tracking-[0.2em] bg-catdex-input-bg rounded-2xl px-4 py-3 text-center">
            {myCode || "—"}
          </span>
          <button
            aria-label="Copiar código"
            onClick={copyCode}
            disabled={!myCode}
            className="w-12 h-12 rounded-2xl bg-catdex-orange/10 text-catdex-orange flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
          >
            {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
          </button>
        </div>
        <button onClick={() => setAddOpen(true)} className="btn-primary w-full mt-4">
          <UserPlus className="h-4.5 w-4.5" />
          Añadir amigo
        </button>
      </Card>

      {/* Incoming requests */}
      <Card>
        <CardTitle className="mb-3">Solicitudes recibidas</CardTitle>
        {loading ? (
          <div className="skeleton h-11 w-full" />
        ) : (
          <IncomingRequests entries={incoming} onChanged={load} />
        )}
      </Card>

      {/* Outgoing requests */}
      {outgoing.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Solicitudes enviadas</CardTitle>
          <div className="space-y-2.5">
            {outgoing.map((e) => (
              <div key={e.friendshipId} className="flex items-center gap-3">
                <FriendAvatar user={e.friend} className="w-11 h-11 text-base" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.friend.name || "Sin nombre"}</p>
                  <p className="text-[0.75rem] text-catdex-text-muted">Pendiente de aceptar</p>
                </div>
                <button
                  aria-label="Cancelar solicitud"
                  onClick={() => handleCancelOutgoing(e)}
                  className="w-9 h-9 rounded-full bg-catdex-input-bg text-catdex-text-muted flex items-center justify-center active:scale-90 transition-transform"
                >
                  <X className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Weekly ranking — friends only, resets Mondays. No divisions/promotion,
          just "who's gained the most this week" among people you know. */}
      {!loading && weeklyRanking.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Ranking semanal</CardTitle>
          <div className="space-y-2.5">
            {weeklyRanking.map((entry, i) => (
              <div key={entry.userId} className="flex items-center gap-3">
                <span className="w-6 text-sm font-bold text-catdex-text-muted text-center shrink-0">
                  {i + 1}
                </span>
                <FriendAvatar user={{ id: entry.userId, name: entry.name, avatar: entry.avatar }} className="w-9 h-9 text-sm" />
                <p className={clsx("flex-1 min-w-0 text-sm truncate", entry.isMe ? "font-bold" : "font-semibold")}>
                  {entry.isMe ? "Tú" : entry.name || "Sin nombre"}
                </p>
                <span className="text-sm font-bold text-catdex-orange">+{entry.weeklyScore}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Active/recent duels */}
      {!loading && duels.length > 0 && (
        <Card>
          <CardTitle className="mb-3">Duelos</CardTitle>
          <div className="space-y-3">
            {duels.map((duel) => (
              <div key={duel.id} className="flex items-center gap-3">
                <FriendAvatar user={duel.otherUser} className="w-10 h-10 text-sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">vs. {duel.otherUser.name || "Sin nombre"}</p>
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
        </Card>
      )}

      {/* Friends list */}
      <Card>
        <CardTitle className="mb-3">Amigos</CardTitle>
        {loading ? (
          <div className="skeleton h-11 w-full" />
        ) : friends.length === 0 ? (
          <p className="text-sm text-catdex-text-muted px-1">
            Aún no tienes amigos. ¡Comparte tu código!
          </p>
        ) : (
          <div className="space-y-2.5">
            {challengeError && <p className="text-[0.8125rem] text-catdex-red px-1">{challengeError}</p>}
            {friends.map((e) => (
              <div key={e.friendshipId} className="flex items-center gap-3">
                <FriendAvatar user={e.friend} className="w-11 h-11 text-base" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{e.friend.name || "Sin nombre"}</p>
                  {e.friend.score != null && (
                    <p className="text-[0.75rem] text-catdex-text-muted">{e.friend.score} pts</p>
                  )}
                </div>
                <button
                  aria-label="Retar a un duelo"
                  onClick={() => handleChallenge(e.friend.id)}
                  disabled={challenging === e.friend.id}
                  className="w-9 h-9 rounded-full bg-catdex-orange/10 text-catdex-orange flex items-center justify-center active:scale-90 transition-transform disabled:opacity-40"
                >
                  <Swords className="h-4.5 w-4.5" />
                </button>
                <button
                  aria-label="Eliminar amigo"
                  onClick={() => setToRemove(e)}
                  className="w-9 h-9 rounded-full bg-catdex-input-bg text-catdex-red flex items-center justify-center active:scale-90 transition-transform"
                >
                  <Trash2 className="h-4.5 w-4.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Add friend sheet */}
      <Sheet open={addOpen} onClose={closeAdd}>
        <div className="px-6 pt-2 pb-4">
          <h2 className="text-base font-bold mb-1">Añadir amigo</h2>
          <p className="text-[0.8125rem] text-catdex-text-muted mb-4">
            Pega el código de invitación de tu amigo
          </p>

          {!preview ? (
            <>
              <input
                className="field font-mono uppercase tracking-[0.2em] text-center"
                placeholder="CÓDIGO"
                value={codeInput}
                onChange={(e) => setCodeInput(e.target.value.toUpperCase())}
                maxLength={8}
                autoFocus
              />
              {resolveError && (
                <p className="text-[0.8125rem] text-catdex-red mt-2">{resolveError}</p>
              )}
              <button
                onClick={handleResolve}
                disabled={resolving || !codeInput.trim()}
                className="btn-primary w-full mt-4"
              >
                {resolving ? "Buscando…" : "Buscar"}
              </button>
            </>
          ) : (
            <div className="animate-pop-in">
              <div className="flex flex-col items-center gap-3 py-4">
                <FriendAvatar user={preview} className="w-20 h-20 text-2xl" />
                <p className="font-bold text-lg">{preview.name || "Sin nombre"}</p>
              </div>
              <button onClick={handleSendRequest} disabled={sending} className="btn-primary w-full">
                {sending ? "Enviando…" : "Enviar solicitud"}
              </button>
              <button onClick={() => setPreview(null)} className="btn-ghost w-full mt-2">
                Volver
              </button>
            </div>
          )}
        </div>
      </Sheet>

      {/* Remove friend confirm */}
      <ConfirmDialog
        open={!!toRemove}
        title="¿Eliminar amigo?"
        message={`Dejaréis de ver vuestras capturas en el mapa. ${
          toRemove?.friend.name || "Este usuario"
        } no recibirá ninguna notificación.`}
        confirmLabel="Eliminar"
        destructive
        onConfirm={handleRemoveFriend}
        onCancel={() => setToRemove(null)}
      />
    </div>
  );
}
