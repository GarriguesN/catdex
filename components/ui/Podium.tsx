"use client";

import clsx from "clsx";
import Link from "next/link";
import { Crown } from "lucide-react";
import { FriendAvatar } from "@/components/friends/FriendAvatar";
import type { GlobalRankEntry } from "@/lib/ranking";

interface PodiumProps {
  /** Top-3 (or fewer if the user base is small) entries of the global ranking. */
  top: GlobalRankEntry[];
}

/**
 * Visual podium for the top-3 of the global ranking.
 *
 * Layout: classic 1-2-3 podium (center/elevated 1st, sides lower). Pure
 * CSS, no images. Uses tokens from globals.css (catdex-orange, card,
 * rounded-2xl, etc.) so it stays indistinguishable from the rest of
 * the app. The gold-tinted crown on rank 1 is the only colored accent
 * — that is the user-facing signal of "you're #1".
 *
 * Empty state: if `top` is shorter than 3 (user base < 3), the missing
 * slots collapse to nothing rather than rendering empty avatars.
 */
export function Podium({ top }: PodiumProps) {
  const rank1 = top[0];
  const rank2 = top[1];
  const rank3 = top[2];

  if (!rank1) {
    // No users yet — render nothing; the parent will show its own empty state.
    return null;
  }

  return (
    <div className="flex items-end justify-center gap-3 py-2">
      {/* 2nd place — slightly shorter */}
      {rank2 && <PodiumColumn entry={rank2} position={2} />}
      {/* 1st place — tallest, with crown accent */}
      <PodiumColumn entry={rank1} position={1} />
      {/* 3rd place — shortest */}
      {rank3 && <PodiumColumn entry={rank3} position={3} />}
    </div>
  );
}

interface PodiumColumnProps {
  entry: GlobalRankEntry;
  position: 1 | 2 | 3;
}

const HEIGHTS = { 1: "h-28", 2: "h-24", 3: "h-20" } as const;
const AVATAR_SIZES = { 1: "w-16 h-16", 2: "w-14 h-14", 3: "w-12 h-12" } as const;

function PodiumColumn({ entry, position }: PodiumColumnProps) {
  const isMe = entry.isMe;

  return (
    <div className="flex flex-col items-center gap-2 flex-1 min-w-0">
      <Link
        href={`/profile/${entry.userId}`}
        className={clsx(
          "relative rounded-full",
          position === 1 && "ring-[3px] ring-catdex-orange ring-offset-2 ring-offset-catdex-cream",
          isMe && "shadow-soft"
        )}
      >
        <FriendAvatar
          user={{ id: entry.userId, name: entry.name, avatar: entry.avatar }}
          className={AVATAR_SIZES[position]}
        />
        {position === 1 && (
          <span
            className="absolute -top-2 -right-1 w-6 h-6 rounded-full bg-catdex-cream flex items-center justify-center shadow-soft"
            aria-label="Primer puesto"
          >
            <Crown className="w-3.5 h-3.5 text-catdex-orange fill-catdex-orange" />
          </span>
        )}
      </Link>
      <p
        className={clsx(
          "text-[0.8125rem] truncate max-w-full",
          isMe ? "font-bold text-catdex-text" : "font-semibold text-catdex-text-secondary"
        )}
        title={entry.name}
      >
        {isMe ? "Tú" : entry.name || "Sin nombre"}
      </p>
      <div
        className={clsx(
          "w-full rounded-2xl flex flex-col items-center justify-center",
          HEIGHTS[position],
          position === 1
            ? "bg-catdex-orange text-catdex-cream"
            : "bg-catdex-input-bg text-catdex-text-secondary"
        )}
      >
        <span className="text-xs font-semibold opacity-80">{position}º</span>
        <span className="text-base font-bold">{entry.score}</span>
        <span className="text-[0.6875rem] opacity-80">pts</span>
      </div>
    </div>
  );
}
