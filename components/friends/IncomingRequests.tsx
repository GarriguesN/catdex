"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { acceptRequest, declineRequest, type FriendEntry } from "@/lib/friends";
import { FriendAvatar } from "./FriendAvatar";

/**
 * Incoming friend request rows with accept/decline — shared by /friends and
 * the notification bell sheet in /profile so the UI isn't duplicated.
 */
export function IncomingRequests({
  entries,
  onChanged,
}: {
  entries: FriendEntry[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handle(action: (id: string) => Promise<unknown>, id: string) {
    setBusyId(id);
    try {
      await action(id);
      onChanged();
    } catch (err) {
      console.error("Friend request action failed:", err);
    }
    setBusyId(null);
  }

  if (entries.length === 0) {
    return (
      <p className="text-sm text-catdex-text-muted px-1">No tienes solicitudes pendientes</p>
    );
  }

  return (
    <div className="space-y-2.5">
      {entries.map((e) => (
        <div key={e.friendshipId} className="flex items-center gap-3">
          <FriendAvatar user={e.friend} className="w-11 h-11 text-base" />
          <p className="flex-1 text-sm font-semibold truncate">{e.friend.name || "Sin nombre"}</p>
          <button
            aria-label="Aceptar"
            disabled={busyId === e.friendshipId}
            onClick={() => handle(acceptRequest, e.friendshipId)}
            className="w-9 h-9 rounded-full bg-catdex-orange text-white flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            <Check className="h-4.5 w-4.5" />
          </button>
          <button
            aria-label="Rechazar"
            disabled={busyId === e.friendshipId}
            onClick={() => handle(declineRequest, e.friendshipId)}
            className="w-9 h-9 rounded-full bg-catdex-input-bg text-catdex-text-muted flex items-center justify-center active:scale-90 transition-transform disabled:opacity-50"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
      ))}
    </div>
  );
}
