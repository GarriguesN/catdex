import type { HTMLAttributes, ReactNode } from "react";
import clsx from "clsx";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  /** Remove default padding (e.g. for full-bleed images) */
  flush?: boolean;
}

export function Card({ children, flush, className, ...rest }: CardProps) {
  return (
    <div className={clsx("card overflow-hidden", !flush && "p-4", className)} {...rest}>
      {children}
    </div>
  );
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <h3 className={clsx("text-[0.9375rem] font-semibold text-catdex-text", className)}>{children}</h3>;
}
