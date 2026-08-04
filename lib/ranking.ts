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
export async function getWeeklyRanking(cachedFriends?: Awaited<ReturnType<typeof listFriends>>): Promise<WeeklyRankEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record;
  if (!me) return [];

  // Pull a fresh score for *me* alongside the ranking fetch — without this,
  // my own score is stale until the next capture or profile edit, while my
  // friends' scores come fresh from the expand. The delta would be off
  // until I touch the app (Fase 1.5).
  try {
    await pb.collection("users").authRefresh();
  } catch {
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
  const snapshotByUser = new Map(snapshots.map((s: { user: string; score: number }) => [s.user, s.score]));

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

export interface GlobalRankEntry {
  userId: string;
  name: string;
  avatar: string;
  score: number;
  isMe: boolean;
}

/** Top N users by accumulated score, across the whole user base. Used
 * for the global podium in /competition (Fase 2.3). Excludes email and
 * any sensitive fields — only name/avatar/score, per the privacy
 * contract documented in /settings/privacy. */
export async function getGlobalRanking(limit?: number): Promise<GlobalRankEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record;
  if (!me) return [];

  // authRefresh so my own score in the returned list reflects the latest
  // server value (consistent with the weekly ranking pattern).
  try {
    await pb.collection("users").authRefresh();
  } catch {}

  const top = limit ?? 20;
  const items = await pb.collection("users").getList(1, top, {
    sort: "-score",
    fields: "id,name,avatar,score",
    $autoCancel: false,
  });

  const meFresh = pb.authStore.record ?? me;
  return items.items.map((u: { id: string; name?: string; avatar?: string; score?: number }) => ({
    userId: u.id,
    name: u.name || "",
    avatar: u.avatar || "",
    score: u.score || 0,
    isMe: u.id === meFresh.id,
  }));
}

export interface GlobalRankPosition {
  rank: number;     // 1-based; "I am Nth"
  total: number;    // total users with score > 0 (or all users, see below)
  score: number;    // my current score (fresh)
  /** The score of the user immediately above me — undefined if I'm #1.
   *  Used by the UI to compute "pts to next rank". */
  nextScore: number | undefined;
}

/** My position in the global ranking, computed with O(1) requests
 * (not "fetch the whole table"). Strategy:
 *   - one query that filters score > mine and reads totalItems → rank
 *   - one query that fetches total users
 *   - one query that fetches the user immediately above me (rank - 1) for
 *     the "pts to next rank" chip in the UI
 * All three run in parallel via Promise.all.
 */
export async function getMyGlobalRank(): Promise<GlobalRankPosition | null> {
  const pb = getPocketBase();
  const me = pb.authStore.record;
  if (!me) return null;

  try {
    await pb.collection("users").authRefresh();
  } catch {}

  const meFresh = pb.authStore.record ?? me;
  const myScore = meFresh.score || 0;

  const [ahead, total, next] = await Promise.all([
    // count of users with strictly higher score
    pb.collection("users").getList(1, 1, {
      filter: `score > ${myScore}`,
      fields: "id",
      $autoCancel: false,
    }),
    // total user count (any score, including 0)
    pb.collection("users").getList(1, 1, {
      fields: "id",
      $autoCancel: false,
    }),
    // the user immediately above me (closest score > mine). PB returns
    // DESC by score, so the LAST item of the list is the one I need to
    // overtake to move up a rank. We fetch perPage=N so we don't miss
    // the closest one if ties exist; if totalItems=0 there's nobody above.
    pb.collection("users").getList(1, 50, {
      sort: "-score",
      filter: `score > ${myScore}`,
      fields: "id,score",
      $autoCancel: false,
    }).then((r) => {
      const items = r.items || [];
      return items[items.length - 1]; // smallest score still > mine
    }).catch(() => undefined),
  ]);

  return {
    rank: ahead.totalItems + 1,
    total: total.totalItems,
    score: myScore,
    nextScore: next?.score,
  };
}
