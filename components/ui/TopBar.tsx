"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";
import { IconButton } from "./IconButton";

interface TopBarProps {
  title?: string;
  /** Show back chevron; navigates back (or to href if given) */
  back?: boolean;
  backHref?: string;
  /** Right-side actions */
  actions?: ReactNode;
  /** Large iOS-style title below the bar */
  largeTitle?: string;
  className?: string;
}

export function TopBar({ title, back, backHref, actions, largeTitle, className }: TopBarProps) {
  const router = useRouter();

  return (
    <header className={clsx("pt-3 pb-2", className)}>
      <div className="flex items-center justify-between min-h-10">
        <div className="flex items-center gap-2">
          {back && (
            <IconButton
              label="Volver"
              onClick={() => (backHref ? router.push(backHref) : router.back())}
              className="-ml-2"
            >
              <ChevronLeft className="h-6 w-6" />
            </IconButton>
          )}
          {title && <h1 className="text-[1.375rem] font-bold tracking-tight">{title}</h1>}
        </div>
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>
      {largeTitle && <h1 className="text-[1.75rem] font-bold tracking-tight mt-2">{largeTitle}</h1>}
    </header>
  );
}
