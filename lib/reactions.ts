/**
 * Reactions on a friend's capture (Fase C.3) — always positive, one per
 * user per photo (upsert on the client, unique index on the server).
 */

import { getPocketBase } from "./pocketbase";

export const REACTION_EMOJIS = ["🐾", "❤️", "😻", "😂"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface ReactionSummary {
  emoji: ReactionEmoji;
  count: number;
}

/** Groups raw rows into per-emoji counts, always in REACTION_EMOJIS order
 * (stable UI regardless of which emojis got used) and drops any unknown/
 * legacy emoji value instead of surfacing a broken chip for it. */
export function aggregateReactions(rows: { emoji: string }[]): ReactionSummary[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    counts.set(row.emoji, (counts.get(row.emoji) || 0) + 1);
  }
  return REACTION_EMOJIS.map((emoji) => ({ emoji, count: counts.get(emoji) || 0 })).filter(
    (r) => r.count > 0
  );
}

export async function getPhotoReactions(
  photoId: string
): Promise<{ summary: ReactionSummary[]; myEmoji: ReactionEmoji | null }> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;
  const rows = await pb.collection("reactions").getFullList({
    filter: `photo="${photoId}"`,
    fields: "emoji,user",
  });
  const summary = aggregateReactions(rows as unknown as { emoji: string }[]);
  const mine = (rows as unknown as { emoji: ReactionEmoji; user: string }[]).find((r) => r.user === myId);
  return { summary, myEmoji: mine?.emoji ?? null };
}

/** Upsert — one reaction per user per photo (matches the unique index). */
export async function setMyReaction(photoId: string, emoji: ReactionEmoji): Promise<void> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;
  const existing = await pb.collection("reactions").getFullList({
    filter: `photo="${photoId}" && user="${myId}"`,
    fields: "id",
  });
  if (existing.length > 0) {
    await pb.collection("reactions").update(existing[0].id, { emoji });
  } else {
    await pb.collection("reactions").create({ photo: photoId, user: myId, emoji });
  }
}

export async function removeMyReaction(photoId: string): Promise<void> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;
  const existing = await pb.collection("reactions").getFullList({
    filter: `photo="${photoId}" && user="${myId}"`,
    fields: "id",
  });
  await Promise.all(existing.map((r) => pb.collection("reactions").delete(r.id)));
}
