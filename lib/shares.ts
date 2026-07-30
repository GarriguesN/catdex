/**
 * Sharing a cat's card — in-app (creates a `shares` row, friends get a
 * notification) and via a public link anyone can open without an account.
 */

import { getPocketBase } from "./pocketbase";

export interface SharedCat {
  catName: string;
  photoId: string | null;
  photoFilename: string | null;
  discovererName: string;
  capturedAt: string;
}

/** Reuses an existing general (non-postcard) share for this cat if there is
 * one. `dedicatedTo=""` excludes postcards (lib/shares.ts's sendPostcard)
 * from this lookup — a postcard row is scoped to one friend and shouldn't
 * be handed out as "the" public link for everyone. */
export async function getOrCreateShareUrl(catId: string): Promise<string> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;

  const existing = await pb.collection("shares").getFullList({
    filter: `cat="${catId}" && sharedBy="${myId}" && dedicatedTo=""`,
    fields: "token",
  });
  const token = existing[0]?.token || (await pb.collection("shares").create({ cat: catId })).token;

  return `${window.location.origin}/s/${token}`;
}

/** A "postcard" — dedicates a cat to one specific friend with an optional
 * message (Fase C.4), as opposed to getOrCreateShareUrl's public link
 * shared broadly. Always creates a new row: each dedication is its own
 * event, not something to dedupe/reuse like the public link is. */
export async function sendPostcard(catId: string, friendId: string, message: string): Promise<void> {
  const pb = getPocketBase();
  await pb.collection("shares").create({ cat: catId, dedicatedTo: friendId, message: message.trim() });
}

/** Public fetch — no PocketBase auth, hits the custom route in pb_hooks/shares.pb.js directly. */
export async function fetchSharedCat(token: string): Promise<SharedCat | null> {
  const pb = getPocketBase();
  const res = await fetch(`${pb.baseUrl}/api/catdex/shared/${encodeURIComponent(token)}`);
  if (!res.ok) return null;
  return res.json();
}

export function sharedPhotoUrl(shared: SharedCat, thumb = "600x600"): string | null {
  if (!shared.photoId || !shared.photoFilename) return null;
  return `${getPocketBase().baseUrl}/api/files/photos/${shared.photoId}/${shared.photoFilename}?thumb=${thumb}`;
}
