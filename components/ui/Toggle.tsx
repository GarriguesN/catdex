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
          // left-1 pins the resting position explicitly — without it, the
          // absolutely-positioned span's "auto" left falls back to the CSS
          // static-position algorithm, which (being the sole child of a
          // <button>, which defaults to text-align:center) resolves to
          // roughly the track's center instead of its edge, pushing the
          // thumb past the track on translate and outside the parent's
          // overflow-hidden card.
          "absolute left-1 top-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}
