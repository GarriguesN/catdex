"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** "surface" = white circle w/ shadow, "overlay" = translucent dark (over photos), "plain" = no bg */
  variant?: "surface" | "overlay" | "plain";
  label: string;
  children: ReactNode;
}

export function IconButton({ variant = "plain", label, className, children, ...rest }: IconButtonProps) {
  return (
    <button
      aria-label={label}
      title={label}
      className={clsx(
        "inline-flex items-center justify-center w-10 h-10 rounded-full transition-transform active:scale-90 shrink-0",
        variant === "surface" && "bg-catdex-surface shadow-soft text-catdex-text",
        variant === "overlay" && "bg-black/30 text-white backdrop-blur-sm",
        variant === "plain" && "text-catdex-text hover:bg-catdex-input-bg",
        className
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
