/** Map preference — show friends' captures. localStorage-backed, defaults to off. */

const KEY = "catdex_map_show_friends";

export function isShowFriendsEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(KEY) === "1";
}

export function setShowFriendsEnabled(enabled: boolean) {
  localStorage.setItem(KEY, enabled ? "1" : "0");
}
