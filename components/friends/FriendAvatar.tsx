"use client";

import clsx from "clsx";
import { friendAvatarUrl, type FriendUser } from "@/lib/friends";

/** Circular avatar with orange-initial fallback, shared by friends UI. */
export function FriendAvatar({ user, className }: { user: FriendUser; className?: string }) {
  const url = friendAvatarUrl(user);
  const initial = (user.name?.[0] || "?").toUpperCase();

  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={url} alt="" className={clsx("rounded-full object-cover shrink-0", className)} />
    );
  }
  return (
    <span
      className={clsx(
        "rounded-full bg-catdex-orange/15 text-catdex-orange font-bold flex items-center justify-center shrink-0",
        className
      )}
    >
      {initial}
    </span>
  );
}
