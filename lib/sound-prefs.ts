/** Sound preference — localStorage-backed, defaults to on. */

const KEY = "catdex_sounds_enabled";

export function areSoundsEnabled(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(KEY) !== "0";
}

export function setSoundsEnabled(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? "1" : "0");
}
