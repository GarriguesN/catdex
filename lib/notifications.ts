/**
 * Generalized notification bell — friend requests already had their own
 * flow (lib/friends.ts listPendingIncoming); this covers the rest (shares,
 * future reactions) via the `notifications` collection written by
 * pb_hooks/notifications.pb.js.
 */

import { getPocketBase } from "./pocketbase";

export interface NotificationEntry {
  id: string;
  type: "friend_request" | "share" | "reaction";
  refId: string;
  read: boolean;
  created: string;
}

/** Unread, most recent first. Doesn't include friend requests — those are
 * counted separately via listPendingIncoming() to avoid double-counting. */
export async function listUnreadNotifications(): Promise<NotificationEntry[]> {
  const pb = getPocketBase();
  const myId = pb.authStore.record?.id;
  if (!myId) return [];
  return pb.collection("notifications").getFullList({
    filter: `user="${myId}" && read=false && type!="friend_request"`,
    sort: "-created",
  }) as unknown as Promise<NotificationEntry[]>;
}

export async function markAllNotificationsRead(entries: NotificationEntry[]): Promise<void> {
  const pb = getPocketBase();
  await Promise.all(
    entries.filter((n) => !n.read).map((n) => pb.collection("notifications").update(n.id, { read: true }))
  );
}
