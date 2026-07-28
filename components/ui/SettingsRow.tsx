"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import clsx from "clsx";

interface SettingsGroupProps {
  children: ReactNode;
  className?: string;
}

/** iOS-style grouped settings container: white card, hairline dividers. */
export function SettingsGroup({ children, className }: SettingsGroupProps) {
  return (
    <div className={clsx("card overflow-hidden divide-y divide-catdex-hairline", className)}>
      {children}
    </div>
  );
}

interface SettingsRowProps {
  icon?: ReactNode;
  label: string;
  /** Small gray value on the right (e.g. "Activados", "v1.0.0") */
  value?: string;
  href?: string;
  onClick?: () => void;
  /** Hide chevron (e.g. informational rows) */
  chevron?: boolean;
  destructive?: boolean;
}

export function SettingsRow({ icon, label, value, href, onClick, chevron = true, destructive }: SettingsRowProps) {
  const content = (
    <>
      {icon && (
        <span className={clsx("shrink-0", destructive ? "text-catdex-red" : "text-catdex-text")}>{icon}</span>
      )}
      <span
        className={clsx(
          "flex-1 text-left text-[0.9375rem] font-medium",
          destructive ? "text-catdex-red" : "text-catdex-text"
        )}
      >
        {label}
      </span>
      {value && <span className="text-[0.8125rem] text-catdex-gray-light">{value}</span>}
      {chevron && <ChevronRight className="h-4.5 w-4.5 text-catdex-gray-light shrink-0" />}
    </>
  );

  const rowClass =
    "w-full flex items-center gap-3.5 px-4 py-3.5 bg-catdex-surface active:bg-catdex-input-bg transition-colors";

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }
  return (
    <button onClick={onClick} className={rowClass} disabled={!onClick}>
      {content}
    </button>
  );
}
