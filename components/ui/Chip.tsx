"use client";

import type { ReactNode } from "react";
import clsx from "clsx";

interface ChipProps {
  active?: boolean;
  onClick?: () => void;
  children: ReactNode;
  className?: string;
}

/** Filter chip — orange filled when active, white pill otherwise. */
export function Chip({ active, onClick, children, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[0.8125rem] font-semibold whitespace-nowrap transition-colors",
        active
          ? "bg-catdex-orange text-white shadow-[0_2px_8px_rgba(255,138,38,0.3)]"
          : "bg-catdex-surface text-catdex-text-muted shadow-soft",
        className
      )}
    >
      {children}
    </button>
  );
}

/** Toggle chip — outlined orange when on, gray when off (Flash / Sonido on save screen). */
export function ToggleChip({ active, onClick, children, className }: ChipProps) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "inline-flex items-center gap-1.5 px-4 py-2 rounded-full border text-[0.8125rem] font-semibold transition-colors",
        active
          ? "border-catdex-orange text-catdex-orange bg-catdex-orange/5"
          : "border-catdex-gray-light/40 text-catdex-gray-light bg-catdex-surface",
        className
      )}
    >
      {children}
    </button>
  );
}
