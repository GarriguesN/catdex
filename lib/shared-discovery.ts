/**
 * Descubrimiento compartido (Fase C.4) — if a friend independently
 * photographed a cat whose pHash nearly matches yours, surface that as a
 * "también lo descubrió [amigo]" moment. Read-only, display-time check —
 * no schema change, nothing persisted (unlike everything else in this
 * plan, there's no server-side write here to get wrong).
 */

import { similarity } from "./phash";
import { getPocketBase } from "./pocketbase";
import { listFriends } from "./friends";
import type { FriendUser } from "./friends";

// tests/phash-spike-results.md found pHash unreliable below ~90% for
// re-identification — only trust a near-exact match here, not a loose one.
export const SHARED_DISCOVERY_THRESHOLD = 90;

export interface HashCandidate {
  hash: string;
  ownerId: string;
}

/** First candidate (in array order) whose hash nearly matches `targetHash`,
 * or null if none clear the threshold. */
export function findMatchingOwner(targetHash: string, candidates: HashCandidate[]): string | null {
  if (!targetHash) return null;
  for (const c of candidates) {
    if (c.hash && similarity(targetHash, c.hash) >= SHARED_DISCOVERY_THRESHOLD) {
      return c.ownerId;
    }
  }
  return null;
}

/** Null if no friend has a matching cat (the common case), or if the user
 * has no friends at all — never throws for either. */
export async function findSharedDiscoverer(
  catHash: string,
  excludeUserId: string
): Promise<FriendUser | null> {
  if (!catHash) return null;

  const friends = await listFriends();
  const friendIds = friends.map((f) => f.friend.id).filter((id) => id !== excludeUserId);
  if (friendIds.length === 0) return null;

  const pb = getPocketBase();
  const filter = friendIds.map((id) => `discoveredBy="${id}"`).join(" || ");
  const candidates = await pb.collection("cats").getFullList({
    filter: `(${filter}) && hash != ""`,
    fields: "hash,discoveredBy",
  });

  const ownerId = findMatchingOwner(
    catHash,
    (candidates as unknown as { hash: string; discoveredBy: string }[]).map((c) => ({
      hash: c.hash,
      ownerId: c.discoveredBy,
    }))
  );
  return ownerId ? (friends.find((f) => f.friend.id === ownerId)?.friend ?? null) : null;
}
