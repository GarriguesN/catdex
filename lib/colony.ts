/**
 * Colonia compartida (Fase C.2) — a collective milestone across you +
 * your friends, celebrated together, no ranking/comparison involved.
 * Which milestones have already been celebrated lives in localStorage
 * (same pattern as lib/map-prefs.ts/lib/sound-prefs.ts) rather than a new
 * PocketBase collection — it's purely a "don't repeat the confetti"
 * client-side flag, not data that needs to sync across devices.
 */

import { getPocketBase } from "./pocketbase";
import { listFriends } from "./friends";

export const COLONY_MILESTONES = [100, 250, 500, 1000, 2500, 5000];

/** Smallest milestone strictly above `total`, or null past the last one. */
export function nextColonyMilestone(total: number): number | null {
  const safeTotal = Number.isFinite(total) ? total : 0;
  return COLONY_MILESTONES.find((m) => m > safeTotal) ?? null;
}

/** Largest milestone at or below `total`, or null if none reached yet. */
export function highestMilestoneReached(total: number): number | null {
  const safeTotal = Number.isFinite(total) ? total : 0;
  let best: number | null = null;
  for (const m of COLONY_MILESTONES) {
    if (safeTotal >= m) best = m;
  }
  return best;
}

const CELEBRATED_KEY = "catdex_colony_celebrated_milestone";

export function getLastCelebratedMilestone(): number {
  if (typeof window === "undefined") return 0;
  return Number(localStorage.getItem(CELEBRATED_KEY)) || 0;
}

export function setLastCelebratedMilestone(milestone: number): void {
  localStorage.setItem(CELEBRATED_KEY, String(milestone));
}

/** Sum of cats discovered by you + your accepted friends. */
export async function getColonyTotal(): Promise<number> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;
  if (!myId) return 0;

  const friends = await listFriends();
  const ids = [myId, ...friends.map((f) => f.friend.id)];
  const counts = await Promise.all(
    ids.map((id) =>
      pb
        .collection("cats")
        .getList(1, 1, { filter: `discoveredBy="${id}"`, fields: "id" })
        .then((r) => r.totalItems)
    )
  );
  return counts.reduce((a, b) => a + b, 0);
}
