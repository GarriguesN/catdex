/**
 * Friends system — thin client over the `friendships` collection and the
 * /api/catdex/resolve-invite custom route (pb_hooks/invite-codes.pb.js).
 */

import { getPocketBase } from "./pocketbase";

export interface FriendUser {
  id: string;
  name: string;
  avatar: string;
  score?: number;
}

export interface FriendEntry {
  /** friendships row id — what accept/decline/remove operate on */
  friendshipId: string;
  friend: FriendUser;
}

/** URL for a user's avatar thumb, or null if they don't have one. */
export function friendAvatarUrl(user: FriendUser): string | null {
  if (!user.avatar) return null;
  return `${getPocketBase().baseUrl}/api/files/users/${user.id}/${user.avatar}?thumb=100x100`;
}

export function getMyInviteCode(): string {
  return getPocketBase().authStore.record?.inviteCode || "";
}

/** Resolves an invite code to { id, name, avatar }. Throws 404 if invalid. */
export async function resolveInviteCode(code: string): Promise<FriendUser> {
  return getPocketBase().send("/api/catdex/resolve-invite", {
    method: "POST",
    body: { code: code.trim().toUpperCase() },
  });
}

export async function sendFriendRequest(addresseeId: string) {
  const pb = getPocketBase();
  return pb.collection("friendships").create({
    requester: pb.authStore.record?.id,
    addressee: addresseeId,
    status: "pending",
  });
}

export async function acceptRequest(friendshipId: string) {
  return getPocketBase().collection("friendships").update(friendshipId, { status: "accepted" });
}

/** Decline an incoming request / cancel an outgoing one / undo a friendship —
 * all modeled as deleting the row. */
export async function declineRequest(friendshipId: string) {
  return getPocketBase().collection("friendships").delete(friendshipId);
}

export const removeFriend = declineRequest;

function toEntry(row: any, friendKey: "requester" | "addressee"): FriendEntry {
  const u = row.expand?.[friendKey];
  return {
    friendshipId: row.id,
    friend: {
      id: u?.id || row[friendKey],
      name: u?.name || "",
      avatar: u?.avatar || "",
      score: u?.score,
    },
  };
}

/** Accepted friendships, mapped so `friend` is always the other user. */
export async function listFriends(): Promise<FriendEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record?.id;
  if (!me) return [];
  // listRule already restricts rows to ones involving me
  const rows = await pb.collection("friendships").getFullList({
    filter: 'status="accepted"',
    expand: "requester,addressee",
    $autoCancel: false,
  });
  return rows.map((r: any) => toEntry(r, r.requester === me ? "addressee" : "requester"));
}

/** Requests waiting for MY acceptance. */
export async function listPendingIncoming(): Promise<FriendEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record?.id;
  if (!me) return [];
  const rows = await pb.collection("friendships").getFullList({
    filter: `status="pending" && addressee="${me}"`,
    expand: "requester",
    $autoCancel: false,
  });
  return rows.map((r: any) => toEntry(r, "requester"));
}

/** Requests I sent that the other person hasn't accepted yet. */
export async function listPendingOutgoing(): Promise<FriendEntry[]> {
  const pb = getPocketBase();
  const me = pb.authStore.record?.id;
  if (!me) return [];
  const rows = await pb.collection("friendships").getFullList({
    filter: `status="pending" && requester="${me}"`,
    expand: "addressee",
    $autoCancel: false,
  });
  return rows.map((r: any) => toEntry(r, "addressee"));
}

export type RelationshipStatus = "none" | "friends" | "incoming" | "outgoing";

/**
 * Current relationship with another user — one query, either direction,
 * any status. Used to turn the generic "duplicate friendship" create error
 * into a precise message (e.g. "you already have a pending request from
 * them, go accept it") instead of leaving the user unable to find the
 * existing row.
 */
export async function getRelationshipStatus(otherId: string): Promise<RelationshipStatus> {
  const pb = getPocketBase();
  const me = pb.authStore.record?.id;
  if (!me) return "none";
  const rows = await pb.collection("friendships").getFullList({
    filter: `(requester="${me}" && addressee="${otherId}") || (requester="${otherId}" && addressee="${me}")`,
    fields: "requester,status",
    $autoCancel: false,
  });
  const row = rows[0] as any;
  if (!row) return "none";
  if (row.status === "accepted") return "friends";
  return row.requester === me ? "outgoing" : "incoming";
}

/** Nº of cats a friend has discovered — reads only totalItems. */
export async function countFriendCats(friendId: string): Promise<number> {
  const result = await getPocketBase()
    .collection("cats")
    .getList(1, 1, { filter: `discoveredBy="${friendId}"`, fields: "id" });
  return result.totalItems;
}
