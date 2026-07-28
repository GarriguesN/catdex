"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

type Variant = "primary" | "secondary" | "ghost" | "destructive";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  full?: boolean;
  children: ReactNode;
}

const VARIANT_CLASS: Record<Variant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  ghost: "btn-ghost",
  destructive:
    "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 font-semibold text-[0.9375rem] text-white bg-catdex-red shadow-soft transition-transform active:scale-[0.97] disabled:opacity-50",
};

export function Button({ variant = "primary", full, className, children, ...rest }: ButtonProps) {
  return (
    <button className={clsx(VARIANT_CLASS[variant], full && "w-full", className)} {...rest}>
      {children}
    </button>
  );
}
