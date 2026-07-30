/**
 * Weekly ranking + duels — pure comparison/date logic here (unit tested);
 * PocketBase-coupled queries at the bottom. The actual weekly snapshot
 * and duel-closing cron live in pb_hooks (goja, not unit-testable from
 * Node) but reuse the same "delta since a start score" concept as
 * computeWeeklyDelta/computeDuelWinner below.
 */

import { getPocketBase } from "./pocketbase";
import { listFriends } from "./friends";

/** UTC date key ("YYYY-MM-DD") of the Monday of the week containing `date`. */
export function weekMondayKey(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  const daysSinceMonday = (day + 6) % 7; // Mon=0, Tue=1, ..., Sun=6
  d.setUTCDate(d.getUTCDate() - daysSinceMonday);
  return d.toISOString().slice(0, 10);
}

/** Never negative — a snapshot taken after the current score (clock skew,
 * or the snapshot cron running mid-request) shouldn't show as a loss. */
export function computeWeeklyDelta(currentScore: number, snapshotScore: number): number {
  const current = Number.isFinite(currentScore) ? currentScore : 0;
  const snapshot = Number.isFinite(snapshotScore) ? snapshotScore : 0;
  return Math.max(0, current - snapshot);
}

export type DuelOutcome = "challenger" | "opponent" | "tie";

export function computeDuelWinner(challengerDelta: number, opponentDelta: number): DuelOutcome {
  if (challengerDelta > opponentDelta) return "challenger";
  if (opponentDelta > challengerDelta) return "opponent";
  return "tie";
}

export interface WeeklyRankEntry {
  userId: string;
  name: string;
  avatar: string;
  weeklyScore: number;
  isMe: boolean;
}

/** You + your accepted friends, ranked by points gained since this week's
 * Monday snapshot. Anyone without a snapshot yet (first week after this
 * feature shipped, before the Monday cron has run once) shows 0 — known,
 * documented limitation, same pattern as pre-migration photos with no city. */
export async function getWeeklyRanking(): Promise<WeeklyRankEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record;
  if (!me) return [];

  const friends = await listFriends();
  const people = [
    { id: me.id, name: me.name, avatar: me.avatar, score: me.score || 0 },
    ...friends.map((f) => ({ id: f.friend.id, name: f.friend.name, avatar: f.friend.avatar, score: f.friend.score || 0 })),
  ];

  const weekKey = weekMondayKey(new Date());
  const idsFilter = people.map((p) => `user="${p.id}"`).join(" || ");
  const snapshots = await pb.collection("weekly_snapshots").getFullList({
    filter: `weekKey="${weekKey}" && (${idsFilter})`,
    fields: "user,score",
  });
  const snapshotByUser = new Map(snapshots.map((s: any) => [s.user, s.score]));

  return people
    .map((p) => ({
      userId: p.id,
      name: p.name || "",
      avatar: p.avatar || "",
      weeklyScore: computeWeeklyDelta(p.score, snapshotByUser.get(p.id) ?? p.score),
      isMe: p.id === me.id,
    }))
    .sort((a, b) => b.weeklyScore - a.weeklyScore);
}
