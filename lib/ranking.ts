/**
 * Weekly ranking + duels — pure comparison/date logic here (unit tested);
 * PocketBase-coupled queries at the bottom. The actual weekly snapshot
 * and duel-closing cron live in pb_hooks (goja, not unit-testable from
 * Node) but reuse the same "delta since a start score" concept as
 * computeWeeklyDelta/computeDuelWinner below.
 *
 * ## Cross-side contract: weekly delta + duel deltas clamp to 0
 *
 * Both client (computeWeeklyDelta, lib/duels.ts:myDelta/theirDelta) and
 * server (pb_hooks/duels.pb.js close-duels cron) clamp deltas to a
 * minimum of 0 with Math.max(0, ...). Decided 2026-08-03 (Fase 1.6):
 *
 *   - Weekly ranking and duels measure *captures since a baseline*, not
 *     risk management. When Fase 5.3 contracts let score decrease, we
 *     still want a duel to read "you gained 0" rather than "you lost 50".
 *
 *   - The clamp lives in two places. They MUST stay in sync. If you
 *     change one, change the other.
 *
 *   - computeWeeklyDelta clamps the snapshot-based weekly score; both
 *     deltas in lib/duels.ts clamp the current-vs-start per-side score.
 *     The close-duels cron in pb_hooks/duels.pb.js clamps the same
 *     per-side score before computing winnerSide, so the server's
 *     winner determination matches what the client displays.
 *
 *   - The two server values (challengerEndScore / opponentEndScore)
 *     stored at close time are NOT clamped — they are the raw scores
 *     at the moment of closing. Only the deltas derived from them are.
 *     This way the numbers can be replayed if we ever change the
 *     clamp policy.
 */

import { getPocketBase } from "./pocketbase";
import { listFriends, type FriendEntry } from "./friends";

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
  /** True if this user has a weekly_snapshots row for the current week.
   *  Used by the UI to distinguish "0 points earned" from "no snapshot
   *  yet, ranking is being prepared" (Fase 1.5). */
  hasSnapshot: boolean;
}

/** You + your accepted friends, ranked by points gained since this week's
 * Monday snapshot. Anyone without a snapshot yet (first week after this
 * feature shipped, before the Monday cron has run once) shows 0 — known,
 * documented limitation, same pattern as pre-migration photos with no city.
 *
 * @param cachedFriends optional list of friends to avoid re-fetching when the
 *   caller (e.g. /competition page) already has them. Saves one round-trip
 *   per page load (Fase 1.5).
 */
export async function getWeeklyRanking(cachedFriends?: FriendEntry[]): Promise<WeeklyRankEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record;
  if (!me) return [];

  // Pull a fresh score for *me* alongside the ranking fetch — without this,
  // my own score is stale until the next capture or profile edit, while my
  // friends' scores come fresh from the expand. The delta would be off
  // until I touch the app (Fase 1.5).
  try {
    await pb.collection("users").authRefresh();
  } catch (_) {
    // refresh is best-effort — ranking still works with the cached score
  }

  const friends = cachedFriends ?? (await listFriends());
  const meFresh = pb.authStore.record ?? me;
  const people = [
    { id: meFresh.id, name: meFresh.name, avatar: meFresh.avatar, score: meFresh.score || 0 },
    ...friends.map((f) => ({ id: f.friend.id, name: f.friend.name, avatar: f.friend.avatar, score: f.friend.score || 0 })),
  ];

  const weekKey = weekMondayKey(new Date());
  const idsFilter = people.map((p) => `user="${p.id}"`).join(" || ");
  const snapshots = await pb.collection("weekly_snapshots").getFullList({
    filter: `weekKey="${weekKey}" && (${idsFilter})`,
    fields: "user,score",
    $autoCancel: false, // see lib/friends.ts:79 — useRefetchOnFocus can fire
                        // while this query is in flight, causing PB to cancel
                        // and the catch to swallow an empty section.
  });
  const snapshotByUser = new Map(snapshots.map((s: any) => [s.user, s.score]));

  return people
    .map((p) => ({
      userId: p.id,
      name: p.name || "",
      avatar: p.avatar || "",
      weeklyScore: computeWeeklyDelta(p.score, snapshotByUser.get(p.id) ?? p.score),
      isMe: p.id === meFresh.id,
      hasSnapshot: snapshotByUser.has(p.id),
    }))
    .sort((a, b) => b.weeklyScore - a.weeklyScore);
}
