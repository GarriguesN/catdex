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

/** Reuses an existing share for this cat (by the current user) if there is one. */
export async function getOrCreateShareUrl(catId: string): Promise<string> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;

  const existing = await pb.collection("shares").getFullList({
    filter: `cat="${catId}" && sharedBy="${myId}"`,
    fields: "token",
  });
  const token = existing[0]?.token || (await pb.collection("shares").create({ cat: catId })).token;

  return `${window.location.origin}/s/${token}`;
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
