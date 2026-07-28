"use client";

import clsx from "clsx";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

/** iOS-style switch — orange when on. */
export function Toggle({ checked, onChange, label }: ToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative w-[3.25rem] h-8 rounded-full transition-colors shrink-0",
        checked ? "bg-catdex-orange" : "bg-catdex-gray-light/40"
      )}
    >
      <span
        className={clsx(
          "absolute top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-[1.375rem]" : "translate-x-1"
        )}
      />
    </button>
  );
}
